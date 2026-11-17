import {httpDataSource} from './httpDataSource';import {mockDataSource} from './mock/dataSource';
export const dataMode: 'mock'|'api'=import.meta.env.VITE_DATA_SOURCE==='api'?'api':'mock';
// Phase 5: only Guests is live in API mode. Other modules remain explicitly
// mock previews until their backend contracts exist; never mask a Guests API error.
export const hotelApi=dataMode==='api'?{...mockDataSource,listGuests:httpDataSource.listGuests}:mockDataSource;
