const log = require('./lib/log')
const util = require('util')
var cool = require('cool-ascii-faces')
var express = require('express');
var app = express();

app.set('port', (process.env.PORT || 61525));

app.use(express.static(__dirname + '/public'));

app.all('*', (req, res, next) => {
	const reqObject = util.format(req).replace('<', '&lt;')
	const resObject = util.format(res).replace('<', '&lt;')
	const message = `<h1>Request</h1><pre>${reqObject}</pre><h1>Response</h1><pre>${resObject}</pre>`;
	log(message)
	res.send(message)
})

// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.get('/home', function(request, response) {
  response.render('pages/index');
});

app.get('/cool', (req, res) => {
	res.send(cool())
})

app.get('/times', (req, res) => {
    var result = ''
    var times = process.env.TIMES || 5
    for (i=0; i < times; i++)
      result += i + ' ';
  res.send(result)
})

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});
