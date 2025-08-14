import { io } from 'socket.io-client';
import { API } from './api';

export const socket = io(API, { transports: ['websocket'] });
