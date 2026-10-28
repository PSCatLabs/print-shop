/** Provider-neutral future boundary. Downloads need no provider or account. */
/**
 * @typedef {{trim:{width:number,height:number,unit:'pt'}, bleed:number,
 *   sides:1|2, quantity:number, stock:string, finish:string}} PrintSpecification
 * @typedef {{id:string, label:string, specification:PrintSpecification}} PrintProduct
 * @typedef {{currency:string, subtotalMinor:number, shippingMinor:number,
 *   expiresAt:string}} PrintQuote
 * @typedef {{listProducts:()=>Promise<PrintProduct[]>,
 *   quote:(request:unknown)=>Promise<PrintQuote>,
 *   submitOrder:(request:unknown)=>Promise<{id:string}>,
 *   getOrder:(id:string)=>Promise<unknown>}} FulfillmentProvider
 */
export const downloadProvider = Object.freeze({id:'download',name:'Download files',requiresAccount:false});
