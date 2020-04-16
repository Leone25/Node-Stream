const config = require('./config.json');

const fs = require('fs');

const express = require('express');
const app = express();
const port = config.port;


var movies = JSON.parse(fs.readFileSync(config.moviesList).toString());

app.use('/public', express.static('public'));

app.get('/', (req, res) => {
	
	var result = fs.readFileSync(config.mainPage).toString();
	
	movies = JSON.parse(fs.readFileSync(config.moviesList).toString());
	
	var tmp = "";
	
	if (Object.keys(movies).length != 0) {
		
		tmp += `<div class="movie-list">`;
		
		//console.log(Object.keys(movies));
		
		Object.keys(movies).forEach(id => {
			tmp += `<div class="movie-thumbnail" style="background-image: url(' ${movies[id].thumbnail || config.movieDefault } ');" onclick="window.location.href = 'movie/${ id }';"></div>`;//${movies[id].name}
		});
		
		tmp += "</div>";
		
	} else {
		
		tmp += "<i> No movies avvailable, sorry </i>";
		
	}
	
	result = substituteString(result, '${list}', tmp);

	res.send(result);
});

app.get('/movie/:id', (req, res) => {
	
	var id = req.params.id;
	
	var tmp = "";
	
	if (!movies[id]) {
		
		var result = fs.readFileSync(config["404Page"]).toString();
		
	} else {		
	
		var result = fs.readFileSync(config.moviePage).toString();
		
		result = substituteString(result, '${id}', id);
		
		Object.keys(movies[id].subtitles).forEach(lang => {
			
			tmp += `<track label="${lang}" kind="subtitles" srclang="${lang}" src="/subtitles/${id}/${lang}.vtt">`;
			
		});
		
		result = substituteString(result, '${subtitles}', tmp);
		
	}
	
	res.send(result);
});

app.get('/stream/:id', (req, res) => {
	
	var id = req.params.id;
	
	const stat = fs.statSync(movies[id].path);
	const fileSize = stat.size;
	const range = req.headers.range;

	if (range) {
		const parts = range.replace(/bytes=/, "").split("-");
		const start = parseInt(parts[0], 10);
		const end = parts[1]
			? parseInt(parts[1], 10)
			: fileSize-1;

		if(start >= fileSize) {
			res.status(416).send('Requested range not satisfiable\n'+start+' >= '+fileSize);
			return;
		}

		const chunksize = (end-start)+1;
		const file = fs.createReadStream(movies[id].path, {start, end});
		const head = {
			'Content-Range': `bytes ${start}-${end}/${fileSize}`,
			'Accept-Ranges': 'bytes',
			'Content-Length': chunksize,
			'Content-Type': 'video/mp4',
		};

		res.writeHead(206, head);
		file.pipe(res);
	} else {
		const head = {
			'Content-Length': fileSize,
			'Content-Type': 'video/mp4',
		};
		res.writeHead(200, head);
		fs.createReadStream(movies[id].path).pipe(res);
	}
});

app.get('/subtitles/:id/:lang.vtt', (req, res) => {
	
	var id = req.params.id;
	var lang = req.params.lang;
	
	
	fs.createReadStream(movies[id].subtitles[lang]).pipe(res);
	
});





app.listen(port, () => console.log(`Running on port ${port}`));


function substituteString(input, stringToChange, substitute) {
	var n = 0;
	while (true) {
		n = input.indexOf(stringToChange, n);
		if (n == -1) { break; } else {
			input = input.replace(stringToChange, substitute);
		}
	}
	return input;
}
