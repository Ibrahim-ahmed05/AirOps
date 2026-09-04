import http from 'k6/http';

export default function() {
  const res = http.get('http://localhost:4000/api/health');
  console.log('Status: ' + res.status);
}
