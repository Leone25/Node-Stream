async function login(user, psw) {
	let response = await fetch('/auth', {
        method: 'POST',
		headers: {
			"Content-Type": "application/json"
		},
        body: JSON.stringify({username:user, password:psw})
    });

    let result = await response.json();
	
	console.log(result);
	
	if (result.cookies) document.cookie = result.cookies;
	
	try {
		document.getElementById("message").innerHTML = result.message;
		document.getElementById("message").style.color = result.color;
		
	} catch (e){}
	
	if (result.redirect) setTimeout(() => {window.location.href = result.redirect}, 1000);
	
}

async function newUser(user, psw, age, perms, info) {
	let response = await fetch('newUser', {
        method: 'POST',
		headers: {
			"Content-Type": "application/json"
		},
        body: JSON.stringify({username:user, password:psw, age:age, permissionLevel:perms, info:info})
    });

    let result = await response.json();
	
	console.log(result);
	
	if (result.status == "OK") window.location.replace(window.location.pathname + window.location.search + window.location.hash);
	
	try {
		document.getElementById("message").innerHTML = result.message;
		document.getElementById("message").style.color = result.color;
		
	} catch (e){}
	
}

async function deleteUser(id) {
	let response = await fetch('deleteUser', {
        method: 'POST',
		headers: {
			"Content-Type": "application/json"
		},
        body: JSON.stringify({id:id})
    });

    let result = await response.json();
	
	console.log(result);
	
	if (result.status == "OK") window.location.replace(window.location.pathname + window.location.search + window.location.hash);
	
	try {
		document.getElementById("message").innerHTML = result.message;
		document.getElementById("message").style.color = result.color;
		
	} catch (e){}
	
}

function selectFile() {
	
	document.getElementById('fileOpener').click();
	
}

function filesUpload(files) {
	const formData = new FormData();

	formData.append('file', files[0]);

	fetch('/upload', {
	  method: 'POST',
	  body: formData
	})
	.then(response => response.json())
	.then(result => {
	  console.log('Success:', result);
	})
	.catch(error => {
	  console.error('Error:', error);
	});
}

//window.open('https://javascript.info/', 'upload', 'location=n0,width=500,height=500')