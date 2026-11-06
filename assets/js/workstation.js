const WIDTH = 1080;
const HEIGHT = 600;
const ink = '#17242e';
const muted = '#435564';
const border = '#d7e0e5';
const paper = '#ffffff';
const teal = '#147e77';

function drawing(canvas) {
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');

  function rect(x, y, w, h, color, outline) {
    ctx.fillStyle = color;
    ctx.fillRect(x,y,w,h);
    if (outline) {
      ctx.strokeStyle = outline;
      ctx.lineWidth = 1;
      ctx.strokeRect(x+.5,y+.5,w-1,h-1);
    }
  }
  function text(value, x, y, size, color = ink, weight = 500, align = 'left') {
    ctx.fillStyle = color;
    ctx.font = weight + ' ' + size + 'px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = align;
    ctx.fillText(value,x,y);
  }
  function line(points, color = border, width = 1) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    points.forEach(([x,y],i) => { if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); });
    ctx.stroke();
  }
  return {rect,text,line};
}

function header({rect,text}, title, subtitle) {
  rect(0,0,WIDTH,52,'#202b32');
  rect(23,25,6,12,'#e5ad17');
  rect(32,18,6,19,'#f5c743');
  rect(41,11,6,26,'#ffdb6b');
  text(title,61,34,23,'#ffffff',650);
  text(subtitle,WIDTH-22,32,18,'#dce7eb',550,'right');
}

export function createReportArtwork(canvas, compact, orders, heldCount) {
  const view = drawing(canvas);
  const {rect,text,line} = view;
  const total = orders.reduce((sum,order)=>sum+order.amount,0);
  const cash = amount => '$'+amount.toFixed(2);
  const bodyWidth = compact ? WIDTH-48 : 826;
  const gap = 12;
  const chartWidth = Math.round(bodyWidth*.51);
  const tableX = 24+chartWidth+gap;
  const tableWidth = bodyWidth-chartWidth-gap;
  const plotLeft = 80;
  const plotRight = 24+chartWidth-21;
  const plotWidth = plotRight-plotLeft;
  const plotBase = 495;
  const plotHeight = 172;
  const axisMax = 120;
  const small = compact?22:18;

  function card(x,y,w,label,value,accent) {
    rect(x,y,w,96,paper,border);
    rect(x+1,y+1,4,94,accent);
    text(label,x+16,y+29,compact?23:20,muted,600);
    text(value,x+16,y+74,compact?43:40,ink,700);
  }

  function chart(selected,progress) {
    rect(24,246,chartWidth,302,paper,border);
    text('Approved value by date',41,280,compact?25:22,ink,650);
    for (const value of [0,30,60,90,120]) {
      const y = plotBase-value/axisMax*plotHeight;
      line([[plotLeft,y],[plotRight,y]],value===0?'#a6b8c2':'#e2e9ed');
      text('$'+value,plotLeft-9,y+5,compact?17:15,muted,500,'right');
    }
    orders.forEach((order,i)=>{
      const x = plotLeft+plotWidth*(i+.5)/orders.length;
      const height = order.amount/axisMax*plotHeight;
      const barHeight = height*progress;
      const barWidth = Math.min(57,plotWidth/6);
      rect(x-barWidth/2,plotBase-barHeight,barWidth,barHeight,selected===order?'#0c625d':'#4b9894');
      text('$'+order.amount,x,plotBase-height-8,small,ink,650,'center');
      text(order.day,x,plotBase+27,small,muted,550,'center');
    });
  }

  function orderTable(selected) {
    rect(tableX,246,tableWidth,302,paper,border);
    text('Approved order detail',tableX+16,280,compact?25:22,ink,650);
    const dateX = tableX + Math.round(tableWidth*.41);
    const right = tableX+tableWidth-16;
    rect(tableX+1,297,tableWidth-2,38,'#eaf0f3');
    text('Order ID',tableX+15,322,small,muted,650);
    text('Date',dateX,322,small,muted,650);
    text('USD',right,322,small,muted,650,'right');
    orders.forEach((order,i)=>{
      const y = 335+i*46;
      const active = order===selected;
      if (active || i%2===1) rect(tableX+1,y,tableWidth-2,46,active?'#dff2ed':'#f6f8fa');
      if (active) rect(tableX+1,y,3,46,teal);
      text(order.id,tableX+15,y+29,small,ink,active?700:550);
      text(order.day,dateX,y+29,small,muted);
      text(cash(order.amount),right,y+29,small,ink,650,'right');
      line([[tableX+12,y+46],[right,y+46]]);
    });
    text('Total',tableX+15,512,small,ink,700);
    text(cash(total),right,512,small,ink,700,'right');
  }

  function filterPane() {
    rect(870,52,210,510,paper);
    line([[870,52],[870,562]]);
    text('Filters',890,88,25,ink,650);
    text('On this page',890,118,17,muted,550);
    const filters = [
      ['Order date','01–05 Oct 2026'],
      ['Currency','USD'],
      ['Record status','All statuses']
    ];
    filters.forEach(([title,value],i)=>{
      const y = 138+i*79;
      rect(887,y,176,66,'#f6f8fa',border);
      text(title,897,y+24,16,ink,650);
      text(value,897,y+49,18,muted,550);
    });
    text('Held orders counted',890,409,16,muted);
    text('in the review card.',890,430,16,muted);
  }

  return (traced,progress)=>{
    const selected = orders.find(order=>order.sourceIndex===traced);
    rect(0,0,WIDTH,HEIGHT,'#edf1f4');
    header(view,'Power BI  /  Order reconciliation','SAMPLE REPORT');
    text('Reconciliation overview',24,97,34,ink,680);
    text('01–05 October 2026  ·  USD',24,125,compact?22:19,muted);
    const width = (bodyWidth-2*gap)/3;
    card(24,138,width,'Approved value',cash(total),teal);
    card(24+width+gap,138,width,'Approved orders',String(orders.length),'#408b88');
    card(24+2*(width+gap),138,width,'Held for review',String(heldCount),'#b38022');
    chart(selected,progress);
    orderTable(selected);
    if (!compact) filterPane();
    rect(0,562,WIDTH,38,'#f7f9fa',border);
    rect(16,596,160,3,teal);
    text('Overview',29,587,18,ink,650);
    text('Illustrative report  ·  1 of 1',WIDTH-21,587,18,muted,500,'right');
  };
}
