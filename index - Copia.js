const config = require('./config.json');

const fs = require('fs');

const express = require('express');
var app = express();
const bodyParser  = require('body-parser');
app.use(express.json());
var cookieParser = require('cookie-parser');
app.use(cookieParser());
const port = config.port;
const bcrypt = require('bcrypt');
const saltRounds = config.saltRounds;
var crypto = require("crypto");


var movies = JSON.parse(fs.readFileSync(config.moviesList).toString());

var users = JSON.parse(fs.readFileSync(config.usersList).toString());

const template = fs.readFileSync(config.templatePage).toString();


async function updateUsersList() {
	
	var res = await fs.writeFile(config.usersList, JSON.stringify(users, null, '\t'), function(err) {
		if(err) {
			return false;
		}

		return true;
	}); 
	
	return res;
	
}

/*
app.use (function (req, res, next) {
	if (req.protocol == 'https') {
			// request was via https, so do no special handling
			next();
	} else if (req.protocol == 'http') {
			// request was via http, so redirect to https
			res.redirect('https://' + req.headers.host + req.url);
	}
});
*/

app.use('/public', express.static('public'));

app.get('/login', (req, res) => {
	
	var message = req.query.message || "";
	
	var result = fs.readFileSync(config.loginPage).toString();
	
	result = substituteString(result, '${message}', message);

	res.send(result);
	
});

app.post('/auth', async (req, res, next) => {
	
	var username = req.body.username || "";
	var password = req.body.password || "";
	
	var result = {message: "User doesn't exist", color:"red"};
	
	console.log(req.body, username, password);
	
	
	if (username == "" || username == undefined) {
		var result = {message: "Please provide a username", color:"red"};
	} else if (password == "" || password == undefined) {
		result = {message: "Please provide password", color:"red"};
	} else {
		for (i = 0; i < users.length; i++) {
			
			console.log(i);
			
			if (users[i].username == username) {
				
				if ((await bcrypt.compare(password, users[i].password)) == true) {
					cookie = generateCookie();
					
					result = {message: "Welcome back "+username, cookies: `session=${cookie}; expires=Fri, 31 Dec 9999 23:59:59 UTC`, redirect: "/", color:"green"};
					users[i].cookie = cookie;
					updateUsersList();
				}else{
					result = {message: "Wrong password", color:"red"};
				}
				break;
				
			}
		}
	}
	
	res.json(result);
	
});

app.get('/logout', (req, res) => {
	
	for (i = 0; i < users.length; i++) {
		if (req.cookies.session == users[i].session) {
			users[i].session = "";
			updateUsersList();
		}			
	}

	res.send("<script>document.cookie='session=; expires=Thu, 01 Jan 1970 00:00:00 GMT';window.location.href='/login?message=Logged out'</script>");
	
});

app.use(function (req, res, next) {
	var logged = isLogged(req.cookies.session);
	
	if (logged == false) {
		res.redirect("/login");
	} else {
		next();
	}
});

app.use('/private', express.static('private'));


app.get('/', (req, res) => {
	
	var tmp = "";
	
	if (Object.keys(movies).length != 0) {
		
		tmp += `<div class="movie-list">`;
		
		Object.keys(movies).forEach(id => {
			if (movies[id].type != "series") {
				tmp += `<div class="movie-thumbnail" style="background-image: url(' ${movies[id].thumbnail || config.movieDefault } ');" onclick="window.location.href = '/movie/${ id }';"></div>`;//${movies[id].name}
			} else {
				tmp += `<div class="movie-thumbnail series-lable" style="background-image: url(' ${movies[id].thumbnail || config.movieDefault } ');" onclick="window.location.href = '/series/${ id }';"></div>`;
			}
		});
		
		tmp += "</div>";
		
	} else {
		
		tmp += "<i> No movies avvailable, sorry </i>";
		
	}
	
	var result = substituteString(template, '${content}', tmp);

	res.send(result);
});

app.get('/series/:id', (req, res, next) => {
	
	var id = req.params.id;
	
	var tmp = `<div class="movie-list">`;
	
	if (!movies[id]) {
		
		next();
		
	} else {		
	
		var result = template;
		
		
		for (i = 0; i < movies[id].episodes.length; i++) {
			
			tmp += `<div class="movie-thumbnail" style="background-image: url(' ${movies[id].episodes[i].thumbnail || config.movieDefault } ');" onclick="window.location.href = '/movie/${ id }/${ i }';"></div>`;
			
		}
		
		tmp += "</div>";
		
		result = substituteString(result, '${content}', tmp);
		
	}
	
	res.send(result);
});

app.get('/movie/:id/:ep', (req, res, next) => {
	
	var id = req.params.id;
	var ep = req.params.ep;
	
	var tmp = "";
	
	if (!movies[id] || movies[id].episodes.length < ep || ep < 0) {
		
		next();
		
	} else {		
	
		var result = fs.readFileSync(config.moviePage).toString();
		
		result = substituteString(result, '${id}', id+"/"+"ep");
		
		Object.keys(movies[id].episodes[ep].subtitles).forEach(lang => {
			
			tmp += `<track label="${lang}" kind="subtitles" srclang="${lang}" src="/subtitles/${id}/${lang}.vtt">`;
			
		});
		
		result = substituteString(result, '${subtitles}', tmp);
		
		res.send(result);
		
	}
});

app.get('/movie/:id', (req, res, next) => {
	
	var id = req.params.id;
	
	var tmp = "";
	
	if (!movies[id]) {
		
		next();
		
	} else if (movies[id].type == "series") {
		
		res.redirect('/series/' + id);
		
	}else {		
	
		var result = fs.readFileSync(config.moviePage).toString();
		
		result = substituteString(result, '${id}', id);
		
		Object.keys(movies[id].subtitles).forEach(lang => {
			
			tmp += `<track label="${lang}" kind="subtitles" srclang="${lang}" src="/subtitles/${id}/${lang}.vtt">`;
			
		});
		
		result = substituteString(result, '${subtitles}', tmp);
		
		res.send(result);
		
	}
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

app.get('/subtitles/:id/:ep/:lang.vtt', (req, res) => {
	
	var id = req.params.id;
	var ep = req.params.ep;
	var lang = req.params.lang;
	
	
	fs.createReadStream(movies[id].episodes[ep].subtitles[lang]).pipe(res);
	
});

app.use(function (req, res, next) {
	var logged = isLogged(req.cookies.session);
	
	if (logged == false || logged.op == false) {
		fs.createReadStream(config["404Page"]).pipe(res);
	} else {
		next();
	}
});

app.get('/pannel', (req, res) => {
	
	res.redirect('/pannel/overview');
	
});

app.get('/pannel/overview', (req, res) => {
	
	var result = substituteString(template, '${content}', fs.readFileSync(config.configPage).toString());
	
	var tmp = `Welcome to the node-stream control pannel <br> You currently have ${Object.keys(movies).length} movies and tv series and ${users.length} users` ;
	
	result = substituteString(result, '${settings}', tmp);
	
	res.send(result);
	
});

app.get('/pannel/users', (req, res) => {
	
	var result = substituteString(template, '${content}', fs.readFileSync(config.configPage).toString());
	
	var tmp = ` <table style="width:100%">`
	
	
	res.send(result);
	
});


/*app.get('/bcrypt/:psw', (req, res) => {
	
	var psw = req.params.psw;
	
	bcrypt.hash(psw, saltRounds, function(err, hash) {
		res.send(hash);
	});
	
	
});

app.get('/random/:l', (req, res) => {
	
	var l = req.params.l;
	
	res.send(crypto.randomBytes(parseInt(l)).toString('hex'));
	
});

app.get('/cookies', (req, res) => {
	
	var cookies = req.cookies;
	
	res.send(cookies);
	
});

app.get('/baseurl', (req, res) => {
	
	var baseurl = req.baseUrl;
	
	res.send(baseurl);
	
});*/


app.use((req, res) => {
	fs.createReadStream(config["404Page"]).pipe(res);
});


app.listen(port, () => console.log(`Running on port ${port}`));


global.substituteString = function (input, stringToChange, substitute) {
	var n = 0;
	while (true) {
		n = input.indexOf(stringToChange, n);
		if (n == -1) break;
		input = input.replace(stringToChange, substitute);
	}
	return input;
}

function generateCookie() {
	
	while (true) {
		
		var cookie = crypto.randomBytes(config.cookieLength).toString('hex');
		
		for (j = 0; j < users.length; j++) {
			if (users[j].cookie == cookie) continue;
		}
		return cookie;
		
	}
	
}	


function isLogged(session)	{
	
	for (j = 0; j < users.length; j++) {
		if (users[j].cookie == session) return users[j];
	}
	
	return false;
}

