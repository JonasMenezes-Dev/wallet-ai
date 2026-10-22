// Entirely fictional text and values. Geometry models four columns, not a real customer's data.
export const item=(text,x,y,width=45)=>({text,x,y,width,height:10});
export const page=(items,number=1)=>({page:number,width:595,height:842,items});
export const heading=(y=100)=>[item('data',30,y),item('lançamentos',100,y,85),item('valor (R$)',410,y,60),item('saldo (R$)',510,y,60)];
export const header=()=>[item('Itaú — extrato conta / lançamentos',30,20,300),
 item('Agência: 0000 Conta: 00000-0',30,40,300),
 item('Período de visualização: 01/03/2026 até 31/03/2026',30,60,340),
 item('Emitido em: 02/04/2026 10:12:00',30,80,250),...heading()];
export function movement(date,description,value,y,balance=null){return [item(date,30,y,60),item(description,100,y,275),
 ...(value===null?[]:[item(value,420,y,45)]),...(balance===null?[]:[item(balance,530,y,40)])];}
export const syntheticItauPdf={pages:[page([...header(),
 ...movement('02/03/2026','SALDO DO DIA',null,120,'900,00'),
 ...movement('03/03/2026','PIX TRANSF PESSOA FICTICIA03/03','-20,00',140),
 ...movement('04/03/2026','RSHOP-LOJA FICTICIA 03/03','-12,50',160),
 ...movement('04/03/2026','PIX DEVOL LOJA FICTICIA03/03','5,00',180),
 ...movement('05/03/2026','PAG BOLETO EMPRESA FICTICIA','-30,00',200),
 ...movement('05/03/2026','REND PAGO APLIC AUT MAIS','0,10',220),
 ...movement('06/03/2026','TED PESSOA FICTICIA','150,00',240),
 ...movement('06/03/2026','SALDO DO DIA',null,260,'992,60'),
]) ]};
