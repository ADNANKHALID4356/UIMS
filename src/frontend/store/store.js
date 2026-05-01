import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import uiReducer from './slices/uiSlice';
import farmerReducer from './slices/farmerSlice';
import dealerReducer from './slices/dealerSlice';
import companyReducer from './slices/companySlice';
import productCategoryReducer from './slices/productCategorySlice';
import productReducer from './slices/productSlice';
import grainReducer from './slices/grainSlice';
import stockReducer from './slices/stockSlice';
import transactionReducer from './slices/transactionSlice';
import organizationReducer from './slices/organizationSlice';
import historyReducer from './slices/historySlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
    farmer: farmerReducer,
    dealer: dealerReducer,
    company: companyReducer,
    productCategory: productCategoryReducer,
    product: productReducer,
    grain: grainReducer,
    stock: stockReducer,
    transactions: transactionReducer,
    organization: organizationReducer,
    history: historyReducer,
  },
});
