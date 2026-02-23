const http = require("http");
const path = require("path");
const fs = require("fs");

const host = '127.0.0.1';
const port = 8082;

const some_mime_types = {
    '.html': 'text/html',
    '.ico': 'image/png',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.js': 'text/javascript',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.zip': 'application/zip',
}

let scissors = {};
let paper = {};
let updateMap = {};

const parseISOString = (s) => {
    let b = s.split(/\D+/);
    return new Date(Date.UTC(b[0], --b[1], b[2], b[3], b[4], b[5], b[6]));
}

const requestListener = (request, response) => {

    let body = '';

    request.on('data', (chunk) => {
        body += chunk;
    });

    request.on('end', () => {

        let filename = request.url.substring(1); // cut off the '/'
      
        if (filename.length === 0)
            filename = 'client.html';
    
        const last_dot = filename.lastIndexOf('.');
        const extension = last_dot >= 0 ? filename.substring(last_dot) : '';

        if (filename === 'generated.html') {
            response.setHeader("Content-Type", "text/html");
            response.writeHead(200);
            response.end(`<html><body><h1>Random number: ${Math.random()}</h1></body></html>`);
        
        } else if (filename === "ajax") {
            let ob = JSON.parse(body);
            
            if (ob.action === "Map") {
                if (ob.id != undefined) {
                    updateMap[ob.id] = [];
                }

                fs.readFile('map.json', 'utf8', (err, data) => {
                    if (err) {
                        console.error(err);
                        response.writeHead(500, { "Content-Type": "application/json" });
                        response.end(JSON.stringify({ error: "Could not read map file" }));
                        return;
                    }

                    let mapObject = JSON.parse(data);
                    console.log("Sending map data: " + JSON.stringify(mapObject));
                    response.end(JSON.stringify(mapObject));
                });

            } else if (ob.action === "Click") {
                if (ob.id != undefined) {
                    updateMap[ob.id] = updateMap[ob.id] || [];
                }

                paper[ob.id] = ob;

                Object.keys(updateMap).forEach((key) => {
                    if (ob.id != key && ob.id != undefined) {
                        updateMap[key].push(paper[ob.id]);
                    }
                });

                response.end();

            } else if (ob.action === "Scissors") {
                scissors[ob.id] = ob;

                Object.keys(updateMap).forEach((key) => {
                    if (ob.userid != key && ob.userid != undefined) {
                        updateMap[key].push(scissors[ob.id]);
                    }
                });

                response.end();

            } else if (ob.action === "Dead") {
                paper[ob.id] = ob;

                Object.keys(updateMap).forEach((key) => {
                    if (ob.id !== key) {
                        updateMap[key].push(paper[ob.id]);
                    }
                });

                response.end();

            } else if (ob.action === "update") {
                let currtime = new Date();

                Object.keys(paper).forEach((key) => {
                    if (!paper[key].time) return;
                    let paperTime = parseISOString(paper[key].time);
                    if ((currtime - paperTime) > 60000) {
                        delete paper[key];
                    }
                });

                Object.keys(scissors).forEach((key) => {
                    if (!scissors[key].time) return;
                    let scissorsTime = parseISOString(scissors[key].time);
                    if ((currtime - scissorsTime) > 60000) {
                        delete scissors[key];
                    }
                });

                let allPaper = Object.values(paper).filter(p => p.id !== ob.id);

                let pendingScissors = {};
                if (updateMap[ob.id]) {
                    for (const update of updateMap[ob.id]) {
                        if (update.action === "Scissors") {
                            pendingScissors[update.id] = update;
                        }
                    }
                }

                let update = { paper: allPaper, scissors: pendingScissors };
                response.end(JSON.stringify(update));

                updateMap[ob.id] = [];
            }

        } else if (extension in some_mime_types && fs.existsSync(filename)) {
            fs.readFile(filename, null, (err, data) => {
                if (err) {
                    response.writeHead(500);
                    response.end("Server Error");
                    return;
                }
                response.setHeader("Content-Type", some_mime_types[extension]);
                response.writeHead(200);
                response.end(data);
            });
        
        } else {
            response.setHeader("Content-Type", "text/html");
            response.writeHead(404);
            response.end(`<html><body><h1>404 - Not found</h1><p>There is no file named "${filename}".</p></body></html>`);
        }
    });
};

const server = http.createServer(requestListener);
server.listen(port, host, () => {
    console.log(`Server is running on http://${host}:${port}`);
});
