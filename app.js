const cookieParser = require('cookie-parser');
const express = require('express');
const io = require('socket.io')();
const logger = require('morgan');
const path = require('path');

const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');

const app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

function prepareNamespace() {
  return Math.random().toString().substring(2, 7);
}

// a simple way to give each pet room unique namespace
const pets = {};
['yuuki', 'sandy', 'ted', 'dolly', 'dexter', 'louis'].forEach((name) => {
  const ns = prepareNamespace();
  pets[name] = ns;
  console.log('Created new namespace for', name, ns);
});

const rootNamespace = io.of('/');

rootNamespace.on('connection', function(socket) {
  console.log('on root namespace');
  socket.emit('pets', pets);
});

const namespaces = io.of(/^\/[0-9]{5}$/);

namespaces.on('connection', function(socket) {
  const namespace = socket.nsp;
  socket.broadcast.emit('connected peer');

  // listen for signals
  socket.on('signal', function(signal) {
      // console.log(signal);
      socket.broadcast.emit('signal', signal);
    })
  // listen for disconnects
  socket.on('disconnect', function() {
    namespace.emit('disconnected peer');
  })
});

module.exports = { app, io };
