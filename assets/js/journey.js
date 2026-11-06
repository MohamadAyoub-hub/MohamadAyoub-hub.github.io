export const orders = [
  {id:'A-101',date:'01 Oct',rawId:' a-101 ',rawDate:'2026/10/01',raw:'$120.00',amount:120,ready:true},
  {id:'A-102',date:'02 Oct',rawId:'A-102',rawDate:'2026-10-02',raw:'89',amount:89,ready:true},
  {id:'A-102',date:'02 Oct',rawId:'A-102',rawDate:'2026-10-02',raw:'89',reason:'Duplicate ID'},
  {id:'A-103',date:'',rawId:'A-103',rawDate:'03/10/2026',raw:'Blank',reason:'Unclear date / amount'},
  {id:'A-104',date:'04 Oct',rawId:'A-104',rawDate:'2026-10-04',raw:'-12',reason:'Negative amount'},
  {id:'A-105',date:'05 Oct',rawId:'A-105',rawDate:'2026-10-05',raw:'58',amount:58,ready:true}
];
export const readyOrders=orders.flatMap((order,sourceIndex)=>order.ready?[{...order,sourceIndex,day:order.date}]:[]);
