const http = require('http');
const https = require('https');
const scraper = require('tiktok-scraper');
const httpProxy = require('http-proxy');

const linkRegex = /(?:https:\/\/)?(?:www\.)?(\w+\.tiktok\.com\/\w+\/?|tiktok\.com\/@.+\/video\/\d+?.*)/;
const mobileLinkRegex = /(?:https:\/\/)?\w+\.tiktok\.com\/\w+\/?/;

let proxy = httpProxy.createProxyServer({});
const PORT = process.env.PORT || 80;

const userAgent = "curl/7.77.0";

function processRequest(meta, req, res) {
    let videoUrl = "";
    if (meta.collector && meta.collector.length > 0)  {
        videoUrl = meta.collector[0].videoUrl;
    }
    proxy.web(req, res, { 
        target: videoUrl,
        headers: meta.headers,
        changeOrigin: true
    });
}

function responseWithError(res, code) {
    res.writeHead(code, { 'Content-Type': 'text/plain' });
    res.end("Oops");
}

function getLink(url) {
    return new Promise(function(resolve, reject) {
        const mobileMatch = url.match(mobileLinkRegex);
        if (mobileMatch) {
            https.get(url, (res) => {
                if(res.statusCode === 301 || res.statusCode === 302) {
                    resolve(res.headers.location);
                } else {
                    reject(new Error("No redirect data for mobile request"));
                }
            })
        } else {
            resolve(url);
        }
    })
}

http.createServer(function (req, res) {
    const match = req.url.match(linkRegex);
    if (match && match.length > 0) {
        getLink(`https://${match[0]}`)
        .then((url) => scraper.getVideoMeta(url) )
        .then((meta) => { processRequest(meta, req, res) })
        .catch((error) => { 
            console.error("Error", error.message);
            responseWithError(res, 500); 
        });
    } else {
        responseWithError(res, 400);
    }
}).listen(PORT);

proxy.on('error', function (err, req, res) {
    console.error("Proxy error", err)
    responseWithError(res, 500);
});
