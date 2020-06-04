/* mysql config users 

CREATE TABLE `users` (
  `id` text NOT NULL,
  `username` text NOT NULL,
  `password` text NOT NULL,
  `2faCode` text NOT NULL,
  `cookie` text NOT NULL,
  `permissionLevel` text NOT NULL,
  `age` text NOT NULL,
  `info` text NOT NULL
) COLLATE 'utf8mb4_unicode_ci';

INSERT INTO users SET id='1a5a32d8cedc1732db4a', username='admin', password='$2b$10$vuHHECecwhUPbR6YzIf.aO/6LB0Z0C45pQnXhAi6qq6D7228Stj72', 2faCode='', permissionLevel='0', age='99', info='foo', cookie=''

*/

/* mysql config movies
CREATE TABLE `movies` (
  `id` text NOT NULL,
  `title` text NOT NULL,
  `type` text NOT NULL,
  `filePath` text NOT NULL,
  `subtitles` text NOT NULL,
  `thumbnail` text NOT NULL,
  `description` text NOT NULL,
  `ageRequirement` text NOT NULL,
  `timestamp` text NOT NULL
) COLLATE 'utf8mb4_unicode_ci';

INSERT INTO movies SET id='1', title='Aladin', type='movie', filePath='upload/Aladin.mp4', subtitles='', thumbnail='https://www.metrotix.com/assets/img/AladdinLamp_thumbnail_520x462-8a1a2c2672.jpg', description='woop', ageRequirement='0', timestamp='0000'

*/

/* mysql config files
CREATE TABLE `files` (
  `id` text NOT NULL,
  `extension` text NOT NULL,
  `type` text NOT NULL,
  `filePath` text NOT NULL,
  `timestamp` text NOT NULL,
  `owner` text NOT NULL
) COLLATE 'utf8mb4_unicode_ci';


*/



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
var mysql = require('mysql');


var db = mysql.createConnection({
  host     : config.dbHost,
  user     : config.dbUser,
  password : config.dbPassword,
  database : config.db
});
 
db.connect();



//var movies = JSON.parse(fs.readFileSync(config.moviesList).toString());

//var users = JSON.parse(fs.readFileSync(config.usersList).toString());

const template = fs.readFileSync(config.templatePage).toString();


/*async function updateUsersList() {
	
	var res = await fs.writeFile(config.usersList, JSON.stringify(users, null, '\t'), function(err) {
		if(err) {
			return false;
		}

		return true;
	}); 
	
	return res;
	
}*/

if (config.redirectHTTPS == true) {
	app.use (function (req, res, next) {
		if (req.protocol == 'https') {
				// request was via https, so do no special handling
				next();
		} else if (req.protocol == 'http') {
				// request was via http, so redirect to https
				res.redirect('https://' + req.headers.host + req.url);
		}
	});
}

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
	
	//console.log(req.body, username, password);
	
	if (username == "" || username == undefined) {
		res.json({message: "Please provide a username", color:"red"});
	} else if (password == "" || password == undefined) {
		res.json({message: "Please provide password", color:"red"});
	} else {
		var result = {message: "User doesn't exist", color:"red"};
		
		db.query( `SELECT * FROM ${config.usersTable} WHERE username = '${username}'`, async function (error, users, fields) {
			
			if (String(users[0].username) == String(username)) {
				
				if ((await bcrypt.compare(password, users[0].password)) == true) {
					cookie = generateUnique(config.usersTable, 'cookie', config.cookieLength);
					
					result = {message: "Welcome back "+username, cookies: `session=${cookie}; expires=Fri, 31 Dec 9999 23:59:59 UTC`, redirect: "/", color:"green"};
					
					await db.query( `UPDATE ${config.usersTable} SET cookie='${cookie}' WHERE username = '${username}'` );
					
				} else {
					result = {message: "Wrong password", color:"red"};
				}
				
			}
			
			res.json(result);
		});
		
	}
	
});

app.get('/logout', async (req, res) => {
	
	await db.query( `UPDATE ${config.usersTable} SET cookie='' WHERE cookie = '${req.cookies.session}'` );

	res.send("<script>document.cookie='session=; expires=Thu, 01 Jan 1970 00:00:00 GMT';window.location.href='/login?message=Logged out'</script>");
	
});

app.use(function (req, res, next) {
	
	db.query( `SELECT * FROM users WHERE cookie = '${req.cookies.session}'`, function (error, users, fields) {
		var logged = users[0]||false;
		if (logged == false) {
			res.redirect("/login");
		} else {
			req.user = logged;
			next();
		}
	});
});

app.use('/private', express.static('private'));


app.get('/', (req, res) => {
	
	db.query( `SELECT * FROM ${config.moviesTable} WHERE ageRequirement <= ${req.user.age || 0}`, function (error, movies, fields) {
		if (error) throw error;
		
		var tmp = "";
		
		console.log(movies);
		
		if (movies.length != 0) {
			
			tmp += `<div class="movie-list">`;
			
			movies.forEach((movie) => {
				if (movie.type == "movie") {
					tmp += `<div class="movie-thumbnail" style="background-image: url(' ${movie.thumbnail || config.movieDefault } ');" onclick="window.location.href = '/movie/${ movie.id }';"></div>`;//${movies[id].name}
				} else if (movie.type == "series") {
					tmp += `<div class="movie-thumbnail series-lable" style="background-image: url(' ${JSON.parse(movie.thumbnail)[0] || config.movieDefault } ');" onclick="window.location.href = '/series/${ id }';"></div>`;
				}
			});
			
			tmp += "</div>";
			
		} else {
			
			tmp += "<i> No movies avvailable, sorry </i>";
			
		}
		
		var result = substituteString(template, '${content}', tmp);

		res.send(result);
	});
	
	
});

app.get('/series/:id', (req, res, next) => {
	
	var id = req.params.id;
	
	db.query( `SELECT * FROM ${config.moviesTable} WHERE ageRequirement <= ${req.user.age || 0} AND id = '${id}' AND type='series'`, function (error, movies, fields) {
		
		var tmp = `<div class="movie-list">`;
		
		if (!movies[0]) {
			
			next();
			
		} else {
			
			for (i = 0; i < movies[id].episodes.length; i++) {
				
				tmp += `<div class="movie-thumbnail" style="background-image: url(' ${movies[id].episodes[i].thumbnail || config.movieDefault } ');" onclick="window.location.href = '/movie/${ id }/${ i }';"></div>`;
				
			}
			
			tmp += "</div>";
			
			result = substituteString(template, '${content}', tmp);
			
		}
		
		res.send(result);
		
	});
});

app.get('/movie/:id/:ep', (req, res, next) => {
	
	var id = req.params.id;
	var ep = req.params.ep;
	
	db.query( `SELECT * FROM ${config.moviesTable} WHERE ageRequirement <= ${req.user.age || 0} AND id = '${id}' AND type='series'`, function (error, movies, fields) {
		
		var tmp = "";
		
		if (!movies[0] || JSON.parse(movies[0].filePath).length - 1 <= ep || ep < 0) {
			
			next();
			
		} else {		
		
			var result = fs.readFileSync(config.moviePage).toString();
			
			result = substituteString(result, '${id}', id+"/"+ep);
			
			res.send(result);
			
		}
		
	});
});

app.get('/movie/:id', (req, res, next) => {
	
	var id = req.params.id;
	
	db.query( `SELECT * FROM ${config.moviesTable} WHERE ageRequirement <= ${req.user.age || 0} AND id = '${id}' AND type='movie'`, function (error, movies, fields) {
		
		var tmp = "";
		
		if (!movies[0]) {
			
			next();
			
		} else if (movies[0].type == "series") {
			
			res.redirect('/series/' + id);
			
		} else {		
		
			var result = fs.readFileSync(config.moviePage).toString();
			
			result = substituteString(result, '${id}', id);
			
			res.send(result);
			
		}
		
	});
});

app.get('/stream/:id/:ep', (req, res) => {
	
	var id = req.params.id;
	var ep = req.params.ep;
	var type = "series";
	
	if (ep == undefined) {
		type = "movie";
	}
	
	db.query( `SELECT * FROM ${config.moviesTable} WHERE ageRequirement <= ${req.user.age || 0} AND id = '${id}' AND type='${type}'`, function (error, movies, fields) {
		
		try {
			var path = JSON.parse(movies[0].filePath);
			path = path[ep];
		} catch (e) {
			var path = movies[0].filePath;
		}
		
		const stat = fs.statSync(path);
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
			const file = fs.createReadStream(path, {start, end});
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
			fs.createReadStream(path).pipe(res);
		}
	});
});

app.get('/stream/:id', (req, res) => {
	
	var id = req.params.id;
	var ep = req.params.ep;
	var type = "series";
	
	if (ep == undefined) {
		type = "movie";
	}
	
	db.query( `SELECT * FROM ${config.moviesTable} WHERE ageRequirement <= ${req.user.age || 0} AND id = '${id}' AND type='${type}'`, function (error, movies, fields) {
		
		try {
			var path = JSON.parse(movies[0].filePath);
			path = path[ep];
		} catch (e) {
			var path = movies[0].filePath;
		}
		
		
		const stat = fs.statSync(path);
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
			const file = fs.createReadStream(path, {start, end});
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
			fs.createReadStream(path).pipe(res);
		}
	});
});

/* subtitle implementation currently on hold

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
	
});*/

app.use(function (req, res, next) {
	if (req.user == false || req.user.permissionLevel != 0) {
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
	
	var tmp = `Welcome to the node-stream control pannel` ;
	
	result = substituteString(result, '${settings}', tmp);
	
	res.send(result);
	
});

app.get('/pannel/users', (req, res) => {
	
	var result = substituteString(template, '${content}', fs.readFileSync(config.configPage).toString());
	
	db.query( `SELECT id, username, age, permissionLevel, info FROM ${config.usersTable} ORDER BY username ASC`, function (error, users, fields) {
		
		var tmp = ` <table style="width:100%; border: solid white 1px;"><tr><th>ID</th><th>Username</th><th>Age</th><th>Permission Level</th><th>Info</th><th>Actions</th></tr>`;
		
		users.forEach((user) => {
		tmp += `<tr><td>${user.id}</td><td>${user.username + ((user.id == req.user.id) ? ' (you)' : '')}</td><td>${user.age}</td><td>${user.permissionLevel}</td><td>${user.info}</td><td><img src="/public/bin.svg" height="50px" width="50px" onclick="deleteUser('${user.id}')"></img></td></tr>`;
		});
		
		tmp += `</table> <div class="space"></div> <div>Create new User</div>
			<div class="space"></div>
			<input type="username" placeholder="Username" id="username">
			<input type="password" placeholder="Password" id="password">
			<input type="number" placeholder="Age" id="age">
			<input type="number" placeholder="Permission Level" id="permissionLevel">
			<input type="text" placeholder="Info" id="info">
			<div class="space"></div>
			<div class="button" onclick="newUser(getElementById('username').value,getElementById('password').value)"> Create user </div>
			<div class="space"></div>
			<div id="message"> </div>`;
		
		result = substituteString(result, '${settings}', tmp);
		
		res.send(result);
	});
});

app.post('/pannel/newUser', (req, res) => {
	
	var username = req.body.username || "";
	var password = req.body.password || "";
	var age = req.body.age || 99;
	var permissionLevel = req.body.permissionLevel || 99;
	var info = req.body.info || "";
	
	//console.log(req.body, username, password);
	
	if (username == "" || username == undefined) {
		res.json({message: "Please provide a username", color:"red"});
	} else if (password == "" || password == undefined) {
		res.json({message: "Please provide password", color:"red"});
	} else {
		
		db.query( `SELECT * FROM ${config.usersTable} WHERE username = '${username}'`, async function (error, users, fields) {
			
			if (users.length > 0) {
				
				res.json({message: "User already exist", color:"red"});
				
			} else {
				
				await db.query( `INSERT INTO ${config.usersTable} SET id='${await generateUnique(config.usersTable, 'id', config.idLength)}', username='${username}', password='${await bcrypt.hash(password, saltRounds)}', 2faCode='', permissionLevel='${permissionLevel}', age='${age}', info='${info}', cookie=''` );
				
				res.json({message: "Done", status: "OK", color:"green"});
			}
		});
	}
});


app.post('/pannel/deleteUser', async (req, res) => {
	
	var id = req.body.id || "";
	
	if (id == "" || id == undefined) {
		res.json({message: "Please select a user", color:"red"});
	} else {
		
		await db.query( `DELETE FROM ${config.usersTable} WHERE id='${id}'`);
		
		res.json({message: "Done", status: "OK", color:"green"});
		
	}
});

app.get('/pannel/movies', (req, res) => {
	
	var result = substituteString(template, '${content}', fs.readFileSync(config.configPage).toString());
	
	db.query( `SELECT id, title, type, filePath, thumbnail, description, ageRequirement, timestamp FROM ${config.moviesTable} ORDER BY title ASC`, function (error, movies, fields) {
		
		var tmp = ` <table style="width:100%; border: solid white 1px;"><tr><th>ID</th><th>Title</th><th>Type</th><th>File Path</th><th>Thumbnal</th><th>Age Requirement</th></th><th>Description</th><th>Timestamp</th><th>Actions</th></tr>`;
		
		movies.forEach((movie) => {
		tmp += `<tr><td>${movie.id}</td><td>${movie.title}</td><td>${movie.type}</td><td>${movie.filePath}</td><td>${movie.thumbnail}</td><td>${movie.ageRequirement}</td><td>${movie.ageRequirement}</td><td>${movie.description}</td><td>${movie.timestamp}</td><td><img src="/public/modify.svg" height="50px" width="50px" onclick="modifyMovie('${movie.id}')"></img><img src="/public/bin.svg" height="50px" width="50px" onclick="deleteMovie('${movie.id}')"></img></td></tr>`;
		});
		
		tmp += `</table> <div class="space"></div> 
				<a href="uploadMovie">Upload movie</a>`;
		
		result = substituteString(result, '${settings}', tmp);
		
		res.send(result);
	});
});

app.get('/pannel/movies', (req, res) => {
	
	var result = substituteString(template, '${content}', fs.readFileSync(config.configPage).toString());
	
	var tmp = `<form id="uploadForm" action="/upload" method="post" encType="multipart/form-data"><input type="file" id="fileOpener" name="upFile" multiple="multiple" style="display: none;" onchange="filesUpload(this.files)"></input></form>`;
	
	
	result = substituteString(result, '${settings}', tmp);
	
	res.send(result);
});

/*app.post('/upload', async (req, res) => {
	
	file = req.files.file;
	
	id = generateUnique(config.filesTable, 'id', filenameLength);
	extension = file.name.substring(file.name.lastIndexOf(".")+1, file.name.length);
	type = config.fileTypes[extension] || "";
	
	await db.query( `INSERT INTO ${config.filesTable} SET id='${id}', extension='${extension}', type='${type}', filePath='${config.uploadFolder+id+"."+extension}', timestamp='${new Date().getTime()}', owner='${req.user.id}'` );
	
	file.mv(config.uploadFolder+id+"."+extension, function(err) {
		var status = 200;
		if (err) status = 500;
		res.json({status: status, id:id, extension:extension, type:type, name:file.name.substring(0, file.name.lastIndexOf(".")), timestamp:new Date().getTime(), owner:req.user.id});
	});
});


app.get('/bcrypt/:psw', (req, res) => {
	
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


substituteString = function (input, stringToChange, substitute) {
	var n = 0;
	while (true) {
		n = input.indexOf(stringToChange, n);
		if (n == -1) break;
		input = input.replace(stringToChange, substitute);
	}
	return input;
}

function generateUnique(table, column, length) {
	
	return new Promise((resolve) => {
		db.query( `SELECT ${column} FROM ${table}`, function (error, data, fields) {
			console.log(data);
			var value;
			while (true) {
				
				value = crypto.randomBytes(length).toString('hex');
				
				console.log(value);
				
				for (j = 0; j < data.length; j++) {
					if (data[j][column] == value) continue;
				}
				
				break;
				
			}
			
			resolve(value);
		});
	});
	
}	