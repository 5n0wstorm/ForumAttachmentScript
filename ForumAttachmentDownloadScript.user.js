// ==UserScript==
// @name Various Forums Gallery Downloader
// @namespace https://github.com/MandoCoding
// @author ThotDev, DumbCodeGenerator, Archivist, Mando
// @description Download galleries from posts on XenForo forums
// @version 1.4.2
// @updateURL https://github.com/MandoCoding/ForumAttachmentScript/raw/main/ForumAttachmentDownloadScript.user.js
// @downloadURL https://github.com/MandoCoding/ForumAttachmentScript/raw/main/ForumAttachmentDownloadScript.user.js
// @icon https://i.imgur.com/5xpgAny.jpg
// @license WTFPL; http://www.wtfpl.net/txt/copying/
// @match https://forum.sexy-egirls.com/threads/*
// @require https://code.jquery.com/jquery-3.3.1.min.js
// @require https://cdnjs.cloudflare.com/ajax/libs/jszip/3.1.5/jszip.min.js
// @require https://unpkg.com/file-saver@2.0.4/dist/FileSaver.min.js
// @require https://cdn.jsdelivr.net/npm/m3u8-parser@4.5.2/dist/m3u8-parser.min.js
// @connect self
// @connect sexy-egirls.com
// @connect bunkr.to
// @connect bunkr.is
// @connect cyberdrop.me
// @connect cyberdrop.cc
// @connect cyberdrop.nl
// @connect cyberdrop.to
// @connect sendvid.com
// @connect i.redd.it
// @connect i.ibb.co
// @connect imgur.com
// @connect putme.ga
// @connect imgbox.com
// @connect pixhost.to
// @connect pixl.is
// @connect nhentai-proxy.herokuapp.com
// @connect pbs.twimg.com
// @connect cdn.discordapp.com
// @connect pixeldrain.com
// @run-at document-start
// @grant GM_xmlhttpRequest
// @grant GM_download
// @grant GM_setValue
// @grant GM_getValue
// @grant GM_log


// ==/UserScript==
const imgurBase = 'https://i.imgur.com/{hash}.mp4';
/**
* Set to 'true', if you wanna be asked to input zip name on your own.
* If 'false' – name for the zip will be generated automatically(default is 'thread name/post number.zip')
*/
const customName = false;
/**
* If 'true' – trying to get video/gif links from iframes(like sendvid and imgur)
*/
const getIFrames = true;
/**
* Determines if emoji should be allowed in the zip name.
* @type {boolean} If set to true, emoji in thread titles will be allowed in the zip name.
*/
const ALLOW_THREAD_TITLE_EMOJI = false;
/**
* Edit this to change the replacement for illegal characters.
* Bad things may happen if you set this to an empty string, and the
* resulting title after replacement contains illegal characters or phrases.
* @type {string} Illegal characters in the thread title will be replaced with this string.
*/
const ILLEGAL_CHAR_REPLACEMENT = '-';
/**
* Determines if a string is null or empty.
* @param {string} str The string to be tested.
* @returns {boolean} True if the string is null or empty, false if the string is not nul or empty.
*/
const isNullOrEmpty = (str) => {
    return !str;
};
/* globals jQuery JSZip saveAs */
/**
* Gets the thread title, removes illegal characters.
* @returns {string} String containing the thread title with illegal characters replaced.
*/
const getThreadTitle = () => {
    // Define file name regexps
    const REGEX_EMOJI = /[\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}\u{1f1e6}-\u{1f1ff}\u{1f191}-\u{1f251}\u{1f004}\u{1f0cf}\u{1f170}-\u{1f171}\u{1f17e}-\u{1f17f}\u{1f18e}\u{3030}\u{2b50}\u{2b55}\u{2934}-\u{2935}\u{2b05}-\u{2b07}\u{2b1b}-\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}]/gu;
    const REGEX_WINDOWS = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$|([<>:"\/\\|?*])|(\.|\s)$/gi;
    // Strip label buttons
    let threadTitle = [...document.querySelector('.p-title-value').childNodes].reduce((title, child) => {
        return child.nodeType === 3 && !isNullOrEmpty(child.textContent) ? (title += child.textContent) : '';
    });
    // Check for title in object
    if (typeof threadTitle === Object) {
        threadTitle = threadTitle['wholeText']
    }
    threadTitle = threadTitle.toString();
    // Remove emoji from title
    if (!ALLOW_THREAD_TITLE_EMOJI) {
        threadTitle = threadTitle.replaceAll(REGEX_EMOJI, ILLEGAL_CHAR_REPLACEMENT);
    }
    threadTitle = threadTitle.replaceAll(REGEX_WINDOWS, ILLEGAL_CHAR_REPLACEMENT);
    threadTitle = threadTitle.trim();
    // Remove illegal chars and names (Windows)
    return threadTitle;
};

/**
* Format bytes as human-readable text.
*
* @param bytes Number of bytes.
* @param si True to use metric (SI) units, aka powers of 1000. False to use
* binary (IEC), aka powers of 1024.
* @param dp Number of decimal places to display.
*
* @return Formatted string.
*/

const allowedDataHosts = ['pixeldrain.com', 'cyberdrop.me'];

function humanFileSize(bytes, si = false, dp = 1) {
    const thresh = si ? 1000 : 1024;
    if (Math.abs(bytes) < thresh) {
        return bytes + ' B';
    }
    const units = si
        ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
        : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    let u = -1;
    const r = 10 ** dp;
    do {
        bytes /= thresh;
        ++u;
    } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);
    return bytes.toFixed(dp) + ' ' + units[u];
}

async function gatherExternalLinks(externalLink, type) {

    if (!type) { return undefined; }
    var resolveCache = [];
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({

            url: externalLink,
            method: "GET",
            responseType: 'document',
            onload: function (response) {
                if (type === "cyberdrop") {

                    var requestResponse = response.response;
                    var linkList = requestResponse.querySelectorAll('.image');

                    for (let index = 0; index < linkList.length; index++) {
                        const element = linkList[index];
                        linkElement = element.getAttribute('href');
                        resolveCache.push(linkElement);
                    }
                    resolve(resolveCache);
                }
                if (type === "bunkr") {

                    var requestResponse = response.response;
                    var linkList = requestResponse.querySelectorAll('.image');

                    for (let index = 0; index < linkList.length; index++) {
                        const element = linkList[index];
                        linkElement = element.getAttribute('href');
                        resolveCache.push(linkElement);
                    }
                    resolve(resolveCache);
                }
            }
        });
    });
}

async function download(post, fileName) {
    var thanks = false;
    var $text = $(post).children('a');
    var urls = getPostLinks(post, false);
    var isLolSafeFork = false;
    for (var i = 0, l = urls.length; i < l; i++) {
        if (urls[i].includes('cyberdrop')) {
            if (urls[i].includes('/a/')) {
                var extUrl = await gatherExternalLinks(urls[i], "cyberdrop");
                if (extUrl.length > 0) {
                    for (let index = 0; index < extUrl.length; index++) {
                        const element = extUrl[index];

                        urls.push(element);
                    }
                }
                urls[i] = '';
            }
            isLolSafeFork = true;
        }
        if (urls[i].includes('bunkr')) {
            if (urls[i].includes('/a/')) {
                var extUrl = await gatherExternalLinks(urls[i], "bunkr");
                if (extUrl.length > 0) {
                    for (let index = 0; index < extUrl.length; index++) {
                        var element = extUrl[index];

                        if (element.includes('stream.bunkr')) {
                            element = element.replace(".to/v/", ".is/d/");
                        }

                        if (element.includes('cdn.bunkr') && !element.includes('.zip')) {
                            if (element.includes(".jpg")){
                                element.replace('cdn.', 'i.');
                            } else{
                                element = element.replace('cdn.', 'stream.');
                                element = element.replace(".is/", ".is/d/");
                                element = element.replace(".to/", ".is/d/");
                            }
                            
                        }
                        urls.push(element);
                    }
                }
                urls[i] = '';
            }
            isLolSafeFork = true;
        }
    }

    urls = urls.filter(function (e) { return e });
    urls = urls.filter(function (v, i) { return urls.indexOf(v) == i; });

    var zip = new JSZip(),
        current = 0,
        total = urls.length;
    function next() {
        if (current < total) {
            const dataText = `Downloading ${current + 1}/${total} (%percent%)`
            const url = urls[current++];
            const isHLS = url.includes('sendvid.com');
            //const isHLS = false;

            $text.text('Downloading...');
            $text.text(dataText.replace('%percent', 0));
            GM_xmlhttpRequest({
                method: isHLS ? 'POST' : 'GET',
                url: isHLS ? 'https://nhentai-proxy.herokuapp.com/hls' : url,
                data: isHLS ? JSON.stringify({ 'url': url }) : null,
                headers: isHLS ? { 'Content-Type': 'application/json' } : null,
                responseType: 'arraybuffer',
                onprogress: function (evt) {
                    var percentComplete = (evt.loaded / evt.total) * 100;
                    $text.text(dataText.replace('%percent', evt.total > 0 ? percentComplete.toFixed(0) : humanFileSize(evt.loaded)));
                },
                onload: function (response) {
                    try {
                        var data = response.response;
                        var name = response.responseHeaders.match(/^content-disposition.+(?:filename=)(.+)$/mi)[1].replace(/\"/g, '');
                    }
                    catch (err) {
                        name = new URL(response.finalUrl).pathname.split('/').pop(); //response.finalUrl.split('/').pop().split('?')[0];
                    } finally {
                        name = decodeURIComponent(name);
                        //Removing cyberdrop's ID from the filename
                        if (isLolSafeFork) {
                            const ext = name.split('.').pop();
                            name = name.replaceAll(/-[^-]+$|\.[A-Z0-9]{2,4}(?=-)/gi, '') + '.' + ext;

                        }
                        zip.file(name, data);
                    }
                    next();
                },
                onerror: function (response) {
                    next();
                }
            });
        } else if (total == 0) {
            $text.text((current == 0 ? 'No Downloads!' : ''));
            return;
        } else {
            $text.text('Generating zip...');
            zip.generateAsync({ type: 'blob' })
                .then(function (blob) {
                    $text.text('Download complete!');
                    if (!GM_download) {
                        saveAs(blob, `${fileName}.zip`);
                    } else {
                        var url = URL.createObjectURL(blob);
                        GM_download({
                            url: url, name: `${fileName}.zip`,
                            onload: function () {
                                URL.revokeObjectURL(url);
                                blob = null;
                            }
                        });
                    }
                });
            //Distribute some love for your downloaded post if it was actually successful
            let likeTag;
            let likeID;
            try {
                likeTag = post.parentNode.parentNode.parentNode.querySelector('.reaction--imageHidden');
                likeID = likeTag.getAttribute('data-th-react-plus-content-id');
                likeTag.setAttribute("href", `/posts/${likeID}/react?reaction_id=49`);
                likeTag.click();
            } catch {
            }
        }
    }
    next();
}

function getPostLinks(post) {
    return $(post)
        .parents('.message-main')
        .first()
        .find('.message-userContent')
        .first()
        .find('.js-lbContainer,.js-lbImage,.attachment-icon a,.lbContainer-zoomer,a.link--external img,video,.js-unfurl,.link--external' + (getIFrames ? ',iframe[src],iframe[data-s9e-mediaembed-src],span[data-s9e-mediaembed][data-s9e-mediaembed-iframe]' : ''))
        .map(function () {
            let link;

            if ($(this).is('iframe') || $(this).is('span')) {
                link = getEmbedLink($(this));
            } else if ($(this).has('source').length) {
                //only select visible source link
                link = $(this)[0]["currentSrc"];
            } else {
                link = $(this).is('[data-url]') ? $(this).data('url') : ($(this).is('[href]') ? $(this).attr('href') : $(this).data('src'));
            }

            // check for valid external hosts
            if ($(this).attr('data-host') !== undefined) {
                if (!allowedDataHosts.includes($(this).attr('data-host'))) {
                    link = '';
                }
            }
            if (typeof link !== 'undefined' && link) {

                if (link.includes('putme.ga')) {
                    if (!link.includes("/image/")){
                        link = link.replace('.th.', '.');
                        link = link.replace(".md.", ".");
                    } else {
                        link = "";
                    }
                }

                if (link.includes('pixl.is')) {
                    link = link.replace('.th.', '.');
                    link = link.replace(".md.", ".");
                }

                if (link.includes('pixhost.to')) {
                    link = link.replace('//t', '//img');
                    link = link.replace("thumbs", "images");
                }

                if (link.includes('imgbox.com')) {
                    link = link.replace('//thumbs', '//images');
                    link = link.replace("_t.", "_o.");
                }

                if (link.includes('preview.redd.it')) {
                    link = link.split('?')[0];
                    link = link.replace('preview', 'i');
                }

                if (link.includes('dropbox.com')) {
                    link = link.replace('?dl=0', '?dl=1');
                }
                // bunkr embedded implementation
                if (link.includes('.bunkr.')) {
                    if (!link.includes('/a/')) {
                        if (link.includes('stream.bunkr')) {
                            link = link.replace(".to/v/", ".is/d/");
                        }

                        if (link.includes('cdn.bunkr') && !link.includes('.zip')) {
                            link = link.replace('cdn.', 'stream.');
                            link = link.replace(".is/", ".is/d/");
                            link = link.replace(".to/", ".is/d/");
                        }
                    }
                }
                // pixeldrain implementation
                if (link.includes('pixeldrain.com')) {
                    if (link.includes('/u/')) {
                        link = link.replace('?embed', '');
                        link = link.replace('/u/', '/api/file/');
                        link = link.concat('?download');
                    }

                    if (link.includes('/l/')) {
                        link = link.split('#item')[0];
                        link = link.replace('/l/', '/api/list/');
                        link = link.concat('/zip');
                    }
                }

            } else {

                link = '';
            }

            return link;
        })
        .get();
}

function inputName(post, callback) {
    var postNumber = $(post).parent().find('li:last-child > a').text().trim();
    var threadTitle = getThreadTitle();
    if (customName && confirm('Do you wanna input name for the zip?')) {
        let zipName = prompt('Input name:', GM_getValue('last_name', ''));
        GM_setValue('last_name', zipName);
        callback(post, zipName ? `${threadTitle}/${zipName}` : (GM_download ? `${threadTitle}/${postNumber}` : threadTitle + ' - ' + postNumber));
    } else {
        callback(post, GM_download ? `${threadTitle}/${postNumber}` : threadTitle + ' - ' + postNumber);
    }
}

function getEmbedLink($elem) {
    let embed;
    if ($elem.is('span')) {
        const attr = $elem.attr('data-s9e-mediaembed-iframe');
        embed = JSON.parse(attr).pop();
    } else {
        embed = $elem.is('[src]') ? $elem.attr('src') : $elem.data('s9e-mediaembed-src');
    }
    if (embed.includes('imgur.min.html')) {
        const hash = embed.split('#').pop();
        const link = imgurBase.replace('{hash}', hash);
        return link;
    }
    if (!embed) return null;
    if (embed.includes('sendvid.com')) {

        return embed;
    }
}

jQuery(function ($) {
    $('.message-attribution-opposite')
        .map(function () { return $(this).children('li:first'); })
        .each(function () {
            var downloadLink = $('<li><a href="#" class="downloadSinglePost"><img src="https://s1.putme.ga/Download27127ce76bc766ac.gif" alt="Download" border="0" width="14" height="14"> Download</a><li>');
            var $text = downloadLink.children('a');
            downloadLink.insertBefore($(this));
            downloadLink.click(function (e) {
                e.preventDefault();
                inputName(this, download);
            });
        });
    // add 'download all' button
    var downloadAllLink = $('<a href="#" class="downloadAllFiles"><img src="https://s1.putme.ga/Download27127ce76bc766ac.gif" alt="Download" border="0" width="14" height="14"> Download All</a>');
    $("div.buttonGroup").css({ 'display': 'inline-flex', 'flex-wrap': 'wrap', 'align-items': 'center' }).prepend(downloadAllLink);
    $(".downloadAllFiles").css({ 'padding-right': '12px' });
    // download all files on page
    $(document).on("click", ".downloadAllFiles", function (e) {
        e.preventDefault();
        var singlePosts = document.querySelectorAll(".downloadSinglePost");
        for (let i = 0; i < singlePosts.length; i++) {
            singlePosts[i].click();
        }
    });
});