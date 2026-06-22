import http from 'http';

http.get('http://127.0.0.1:5001/api/auth/sessions', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    console.log('BODY:', data);
  });
}).on('error', (err) => {
  console.error('ERROR connecting to local server:', err.message);
});
