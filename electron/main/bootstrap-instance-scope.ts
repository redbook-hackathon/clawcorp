import { app } from 'electron';
import { configureAppInstanceScope } from './app-instance-scope';

export const appInstanceScope = configureAppInstanceScope(app);
