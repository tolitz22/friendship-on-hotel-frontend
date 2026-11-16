import {httpDataSource} from './httpDataSource';import {mockDataSource} from './mock/dataSource';
export const dataMode: 'mock'|'api'=import.meta.env.VITE_DATA_SOURCE==='api'?'api':'mock';
export const hotelApi=dataMode==='api'?httpDataSource:mockDataSource;
