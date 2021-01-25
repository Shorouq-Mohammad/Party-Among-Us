const express = require('express');
const mongoose = require('mongoose');
const api = require('./server/routes/api');
const Room = require('./server/models/Room.js');
const PORT = process.env.PORT || 4200;
const URI = process.env.MONGODB_URI || 'mongodb://localhost/roomsDB';
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
	cors: {
		origin: '*',
		allowedHeaders: ["content-type"]
	},
	pingInterval: 10000,
	pingTimeout: 5000
});

const { PLAY, PAUSE, SYNC_TIME, NEW_VIDEO, REMOVE_PLAYER, NEW_PLAYER_HOST, API_PATH, VIDEO_INFORMATION_NEW
	,ASK_FOR_VIDEO_INFORMATION, SYNC_VIDEO_INFORMATION, NEW_SONG, SUGGEST_SONG, VOTE_SONG,  PLAY_SONG, HOST_SYNC_TIME,
	JOIN_ROOM, ADD_PLAYER, MOVE_PLAYER, SEND_MESSAGE, RECEIVED_MESSAGE, PLAYER_MOVED, LEAVE_ROOM } = require('./src/Constants');


app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static('node_modules'));

app.use(function (req, res, next) {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
	res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');

	next();
});

app.use(API_PATH, api);

mongoose.connect(URI, { useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false, useCreateIndex: true, connectTimeoutMS: 5000, serverSelectionTimeoutMS: 5000 })
	.then(function () {
		server.listen(PORT, () => console.log(`Listening on port ${PORT}`));
	})
	.catch(function (err) {
		console.log(err.message);
	});

io.on('connection', function (socket) {
	let current_room;

	socket.on(JOIN_ROOM, async (data) => {
		await socket.join(data.room);
		current_room = data.room;
		data.player && socket.to(data.room).emit(ADD_PLAYER, data.player);
		data.host && io.to(data.host).emit(ASK_FOR_VIDEO_INFORMATION, data.player.playerId);
	});

	socket.on(LEAVE_ROOM, () => {
		socket.to(current_room).emit(REMOVE_PLAYER, socket.id);
		current_room = null;
	});

	socket.on('disconnect', async(data) => {
		if (current_room) {
			socket.to(current_room).emit(REMOVE_PLAYER, socket.id);
			await Room.findOneAndUpdate({ _id: current_room }, { "$pull": { guests: { "id": socket.id } } });
		}
	});

	socket.on(PLAY, () => {
		socket.to(socket.room).emit(PLAY);
	});

	socket.on(PAUSE, () => {
		socket.to(socket.room).emit(PAUSE);
	});

	socket.on(SYNC_TIME, (data) => { // send to all users in room including host (only host emit it)
		io.in(data.room).emit(SYNC_TIME, data.currentTime);
	});

	socket.on(NEW_VIDEO, (videoURL) => {
		io.to(socket.room).emit(NEW_VIDEO, videoURL);
	});

	socket.on(ASK_FOR_VIDEO_INFORMATION, () => {
		socket.to(socket.room).emit(ASK_FOR_VIDEO_INFORMATION);
	});

	socket.on(SYNC_VIDEO_INFORMATION, (data) => {
		io.to(socket.room).emit(SYNC_VIDEO_INFORMATION, data);
	});

	socket.on(MOVE_PLAYER, (data) => {
		socket.to(data.room).emit(PLAYER_MOVED, data);
	});

	socket.on(SEND_MESSAGE, (data) => {
		socket.to(data.room).emit(RECEIVED_MESSAGE, data);
	});

	socket.on(SUGGEST_SONG, (data) => {
		socket.to(data.room).emit(NEW_SONG, data);
	})

	socket.on(VOTE_SONG, (data) => {
		socket.to(data.room).emit(VOTE_SONG, data);
	})

	socket.on(NEW_PLAYER_HOST, (data) => { 
		io.to(data.socket).emit(NEW_PLAYER_HOST, data.players);
	})

	socket.on(VIDEO_INFORMATION_NEW, (data) => {//only host emit this to send to new member
		io.to(data.socket).emit(VIDEO_INFORMATION_NEW, data)
	})

	socket.on(PLAY_SONG, (data) => {//host emit it to all the room 
		socket.to(data.room).emit(PLAY_SONG, data)
	})

	socket.on(HOST_SYNC_TIME, (data)=> {//only sent to host with the host info
		io.to(data).emit(HOST_SYNC_TIME)
	})
});