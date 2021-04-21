
/*app.js
Jake Levy
Nov 2020

This the activity DB server program (insert and search)
modified to work with Express App.  Express allows us to 
write code that is easier to read and follow by handling
routing automatically for us.  We no longer need long if/else
chains to figure out how to route requests for our applications.

Instead we can create an instance of the Express routing "app" 
and tell it which combination of Routes and HTTP methods 
to which we want it to respond*/
var tracker = require("tracker");
var http = require("http");
var qString = require("querystring");
//this calls the let db={}; and instantiates the db for us
let dbManager = require('./dbManager');
let express = require("express");
let app = express();
var ObjectID = require('mongodb').ObjectId;
var userRouter = require('./routes/userRoutes.js')
//var Exercise = require("tracker/Exercise");

let mongoose = require('mongoose');
mongoose.set('bufferCommands', false);

const actCol=require('./models/activitySchema');

//This has been modified to return a Mongoose Model instance (a document)
function docifyActivity(params){
    let doc = new actCol({ activity: { type : params.activity.toString().toLowerCase() }, weight: params.weight,
		distance: params.distance, time: params.time, user: params.user});
    return doc;
}

//The same server response from the activity_server lab
//this time it is specifically used for db inserts

var postParams;
function moveOn(postData){
    let proceed = true;
    postParams = qString.parse(postData);
    //handle empty data
    for (property in postParams){
	if (postParams[property].toString().trim() == ''){
	    proceed = false;
	}
    }

    return proceed;
}
//The order of provided routing functions matters.  They work similarly to
//cases in a switch statement.  The first matching route is run.
//the response methods 'send' and 'end' will end the "request response cycle"
//If the cycle is not ended then the request will "hang".
// These are NOT the same methods provided by the standard response object of HTTP
//But instead are methods provided by Express.   A full list of methods that can
//be used to end the cycle
app.set('views', './views');
app.set('view engine', 'pug');
app.use('/users', userRouter);
//GET ROUTES
//These callback functions in "Express syntax" are called "middleware" functions.
//They sit "in the middle" between your app's backend end functionality
//(in this case, the simple Activity Class, MongoDB, and/or the local
//"server" filesystem) and the client.  Middleware function's 
app.get('/', function (req, res){
    res.end('<html><body><br><br><a href="/insert">home/insert</a>&emsp;&emsp;<a href="/search">sea\
rch Page</a></body></html>');
});
app.use(function(req, res, next){
    let now = new Date().toLocaleTimeString("en-US", {timeZone: "America/New_York"});
    console.log(`${req.method} Request to ${req.path} Route Received: ${now}`);
    next();
});

app.get('/login', function(req, res, next){

});
app.get('/insert', function (req, res){
   // let page = servResp(null, res);
    //    res.send(page);
    res.render('insert');
});
//demonstrates error handling with Express
//This error is unlikely but this middleware function demonstrates how to use
//Express to process caught errors.  Passing errors to the "next" function
//allows Express to catch them and do its own error handling

//using the Express Error handler is not required and it really only prints
//a stack trace of the error (the series of called functions that generated
//the error).  But if you want only basic error handling, you can use it
app.get('/search', function(req, res, next){
//    searchResp(null, res).then(
//	page=> {    res.send(page); }
    //    ).catch(next);
    res.render('search');
});
app.param('actID', function(req, res, next, value){
    console.log(`Request for activity ${value}`);
    next();
});


app.get('/activities/:actID', async function(req, res){
   
    //let col = dbManager.get().collection("activities");
    try{
	let result = await actCol.findOne({ _id: ObjectID(req.params.actID) });
	console.log(result);

	res.render('activity', { searchID: result.user, exercise: result.activity.type, distance: result.distance, weight: result.weight })
    }catch(e){
	console.log(e.message);
    }
});
var postData;

//POST ROUTES
app.post('/insert', function(req, res){
    postData = '';
    req.on('data', (data) =>{
	postData+=data;
    });
    req.on('end', async ()=>{
	//Break into functions
	postParams = qString.parse(postData)
	
	    //let col = dbManager.get().collection("activities");
	    //on the insert page
		try{
		    //if the data is bad, object creation throws an
		    //error (as we have seen since Week 4).
		    //And no document will be inserted
		    var curTracker = new tracker(postParams.activity,
						 postParams.weight,
						 postParams.distance,
						 postParams.time);
		    calories = curTracker.calculate();
		    
		    //convert params to a document for Mongo
		    let curDoc = docifyActivity(postParams);

		    //insert the document into the db
			await curDoc.save() 
		    //return calories as response (Success)
//		    let page =  servResp(calories, res);
		    res.render('insert', { calories: calories});
		   
		} catch (err){		 
		    res.render('insert', { calories: err.message});
		    //res.send(page);
		}
	
    });
    	    
});

app.post('/search', function(req, res){
    postData = '';
    req.on('data', (data) =>{
	postData+=data;
    });
    req.on('end', async ()=>{
	//Break into functions
	console.log(postData);
	if (moveOn(postData)){
	    //let col = dbManager.get().collection("activities");
	    var prop= postParams.prop;
	    var val = postParams.value;
	    if (prop != "user" && prop != "activity.type"){
		val = Number(postParams.value);
	    }
	    //simple equality search. using [] allows a variable
	    //in the property name
	    let searchDoc = { [prop] : val };
	    try{
			
			let cursor = await actCol.find(searchDoc,  '_id activity distance user weight time').exec();
		
			let data = [];
		
		await cursor.forEach((item)=>{
		    let curTrack={};   
		    curTrack.calories =  new tracker(item.activity.type, item.weight, item.distance, item.time).calculate();
		    curTrack.user = item.user;
		    curTrack._id=item._id;
		    data.push(curTrack);
		})
		let resultOBJ={dataArr: data , [prop]  : val, prop: prop};

		res.render('search', {results: resultOBJ});
		
//		searchResp(resultOBJ, res).then( page =>
//						  {res.send(page)
//						  });//call the searchPage
	    } catch (e){
		console.log(e.message);
		res.writeHead(404);
		res.write("<html><body><h1> ERROR 404. Page NOT FOUND</h1>");
		res.end("<br>" + e.message + "<br></body></html>");
	    }
	} else{ // can't move on
	   // searchResp(null, res).then(
	    //	page => {res.send(page)}
	    //	);
	    res.render('search');
	}
    });
});
//Routes are loaded *in order*.  Like Switch cases, if a route
//gets matched early then it won't match later routes.  So
//RUNS for any ROUTE not matched to those methods above
app.use('*', function(req, res){
    res.writeHead(404);
    res.end(`<h1> ERROR 404. ${req.url} NOT FOUND</h1><br><br>`);
});
app.use((err, req, res, next)=>{
	res.status(500).render('error', {message: err.message})
})

//Express listen function is literally the HTTP server listen method
//so we can do the exact same things with it as before
app.listen(6900, async ()=> {
    //start and wait for the DB connection
    try{
		await mongoose.connect('mongodb://localhost:27017/practiceDB', {useNewUrlParser: true, useUnifiedTopology: true })

		// await dbManager.get("practiceDB");
    } catch (e){
        console.log(e.message);
    }

    console.log("Server is running...");
});
