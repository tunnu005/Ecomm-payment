import { pool } from "./dbconnection";


export const createnewtransaction = async(order_id:number,payment_status:string,payment_gateway:string,amount:number,payment_date:Date,transfer_id:string)=>{
    try {
        const query = `INSERT INTO "transactions" ("order_id", "payment_status", "payment_gateway", "amount", "payment_date", "transfer_id") VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;`
        const values = [order_id, payment_status, payment_gateway, amount, payment_date, transfer_id];
        await pool.query(query, values)
    } catch (error) {
        console.log(error);
        throw new Error('Error creating new transaction')
    }
}


