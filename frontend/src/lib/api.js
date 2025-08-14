import axios from 'axios';

const API =
  import.meta.env.VITE_API_URL ||
  `http://${window.location.hostname}:3001`;

const api = axios.create({
  baseURL: API,
  headers: { 'Content-Type': 'application/json' }
});

export { api, API };
