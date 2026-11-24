import CONST from '@src/CONST';
import type ConvertToLTR from './types';

const convertToLTR: ConvertToLTR = (text) => `${CONST.UNICODE.LTR}${text}`;

export default convertToLTR;
