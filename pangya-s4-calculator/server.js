const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;
app.get('/health', (_req,res) => res.status(200).send('ok'));
app.use(express.static(path.join(__dirname,'public'), { extensions:['html'] }));
app.get('*', (_req,res) => res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(port,'0.0.0.0',() => console.log('PangYa S4 Calculator running on '+port));
