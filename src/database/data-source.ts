import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { configuration } from '../config/configuration';
import { validateEnvironment } from '../config/validation';
import { createTypeOrmOptions } from './typeorm.config';

if (existsSync('.env')) {
  loadEnvFile('.env');
}

if (existsSync('.env.local')) {
  loadEnvFile('.env.local');
}

validateEnvironment(process.env);

const appEnvironment = configuration();

export default new DataSource(createTypeOrmOptions(appEnvironment));
