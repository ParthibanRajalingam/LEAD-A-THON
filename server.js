const express = require('express')
const app = express()
var cors = require('cors')
const fs = require('fs');
const got = require('got');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
var Cache = require('ttl-cache'),
cache = new Cache();
const chessEcoUrl= 'https://www.chessgames.com/chessecohelp.html';
const port = process.env.PORT || 3000;
app.use(cors())

//Method to load the chess opening moved by reading HTML.
const loadChessData = new Promise((resolve,reject) =>{
	got(chessEcoUrl).then(response => {
		const dom = new JSDOM(response.body);
		let chessElements = dom.window.document.querySelectorAll("td");
		let chessEcoOpenings = [];
		if(chessElements.length){
			for(let x = 0; x < chessElements.length; x++){
				let moveId = chessElements[x].getElementsByTagName("font")[0].innerHTML;
				x++;
				let moveName = chessElements[x].getElementsByTagName("font")[0].getElementsByTagName("b")[0].innerHTML;
				let moves = chessElements[x].getElementsByTagName("font")[0].getElementsByTagName("font")[0].innerHTML;
				chessEcoOpenings.push({"moveId":moveId,"moveName":moveName,"moves":moves})
				if(x == chessElements.length -1){
					cache.set("chessOpenings",chessEcoOpenings);
					cache.ttl("chessOpenings", 180);
					resolve(chessEcoOpenings)
				}
			}
		}
		else{
			reject("No data present.")
		}
	}).catch(err => {
		reject(err)
		console.log(err);
	});
});

//Function to find the opening move by opening code
const getOpeningByCode = (code) => {
	return new Promise((resolve,reject) => {
	let chessOpenings = cache.get("chessOpenings");
	if(!chessOpenings){
		loadChessData.then((data) => {
			chessOpenings = data;
			getOpeningFromOpenings(data,code).then((data, err)=>{
				resolve(data)
			}).catch(err => reject(err))

		});
	}
	else{
		getOpeningFromOpenings(chessOpenings,code).then((data,err)=>{
				resolve(data)
			}).catch(err => reject(err))

	}
})	
}

//Function that takes set of opening moves and opening code and will return the matching opening move
const getOpeningFromOpenings = (openings, code) => {
	return new Promise((resolve,reject) => {
		if(openings && openings.length){
		for(opening in openings){
			if(openings[opening].moveId.toUpperCase() == code.toUpperCase()){
				resolve(openings[opening])
			}

			if(opening == openings.length - 1){
				reject("The given opening move is not present in the data set..")
			}
		}
	}
	else{
		reject("No opening moves present..")
	}
	});
}

//Get method to return all opening moves
app.get('/', (req, res) => {
	if(cache.get("chessOpenings")){
		res.send(cache.get("chessOpenings"))
	}
	else{
		loadChessData.then((data) => {
			res.send(data)
		})

	}
})

//Get API to return matching opening move by move id
app.get('/:code', (req, res) => {
	let pathParam = req.params.code;
	getOpeningByCode(pathParam).then(data => {
		res.send(data)
	}).catch(err => res.send(err));
})

//code and get next move
app.get('/:code/*', (req, res) => {
	let code = req.params.code;
	let moves = req.params['0'] ? req.params['0'].split('/') : [];
	if(moves && moves.length){
			moves = moves.map( x => x.toUpperCase());
			getOpeningByCode(code).then(data => {
			let openingMoves = data.moves.split(' ').filter(i => /^[a-zA-Z]+\d+$/.test(i));
			openingMoves = openingMoves.map( x => x.toUpperCase());
			let currentMove = moves[moves.length -1];
			let indexOfCurrentMove = openingMoves.indexOf(currentMove);
			if(indexOfCurrentMove && openingMoves.length > indexOfCurrentMove ){
				res.send(openingMoves[indexOfCurrentMove + 1]);
			}
			else{
				res.send("Unable to get the next move");
			}
	}).catch(err => res.send(err));
	}
	else{
		res.send("Nor a valid opening..");
	}
})

//Cache will be loaded with opening moves while the aplication start
app.listen(port, () => {
	loadChessData.then((data) => {
			console.log('Chess data loaded successfully')
		}).catch(err => console.log("Error while loading chess data.."));
	console.log(`Chess app listening at http://localhost:${port}`)
})
