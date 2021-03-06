const fs = require('fs');
const r = require('rethinkdb');
const express = require('express');
const app = require('express')();


const options = {
  key: fs.readFileSync('/etc/letsencrypt/live/gdev.pp.ua/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/gdev.pp.ua/cert.pem')
  // key  : fs.readFileSync('/etc/ssl/private/selfsigned.key'),
  // cert : fs.readFileSync('/etc/ssl/certs/selfsigned.crt')
};

const https = require('https').createServer(options, app);


//const http = require('http').Server(app);
const io = require('socket.io')(https);

r.connect({host: 'localhost', port: 28015}, (err, conn) => {
  if (err) throw err;
  r.db('test').tableList().run(conn, (err, response) => {
    if (response.indexOf('edit') > -1) {
      // do nothing it is created...
      console.log('Table exists, skipping create...');
      console.log('Tables - ' + response);
    } else {
      // create table...
      console.log('Table does not exist. Creating');
      r.db('test').tableCreate('edit').run(conn);
    }
  });

  io.on('connection', (socket) => {
    console.log('a user connected');
    socket.on('disconnect', () => {
      console.log('user disconnected');
    });

    socket.on('document-update', (msg) => {
      console.log(msg);
      r.table('edit').insert({
        id: msg.id,
        value: msg.value,
        user: msg.user
      }, {conflict: "update"}).run(conn, (err, res) => {
        if (err) throw err;
        console.log(JSON.stringify(res, null, 2));
      });
    });

    r.table('edit').changes().run(conn, (err, cursor) => {
      if (err) throw err;
      cursor.each((err, row) => {
        if (err) throw err;
        io.emit('doc', row);
      });
    });
  });

  app.get('/getData/:id', (req, res, next) => {
    r.table('edit').get(req.params.id).run(conn, (err, result) => {
      if (err) throw err;
      res.header('Access-Control-Allow-Origin', '*');
      res.send(result);
      // return next(result);
    });
  });

});


// Serve HTML
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});
app.use('/fontAwesome', express.static('fontAwesome', {
  setHeaders: (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
  }
}));

// Setup Express Listener
//http.listen(8080, '0.0.0.0', () => {
//  console.log('listening on: 0.0.0.0:8080');
//});

https.listen(443, () => {
  console.log('Started!');
});
