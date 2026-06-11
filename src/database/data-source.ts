import { loadEnvFile } from 'node:process';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { configuration } from '../config/configuration';
import { createTypeOrmOptions } from './typeorm.config';

loadEnvFile('.env');
loadEnvFile('.env.local');

const appEnvironment = configuration();

export default new DataSource(createTypeOrmOptions(appEnvironment));
