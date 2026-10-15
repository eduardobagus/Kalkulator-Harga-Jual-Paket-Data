/**
 * Official CSV Templates for each of the 5 product menus.
 */

export const CSV_TEMPLATES = {
  simcard: {
    filename: "template_simcard.csv",
    label: "Simcard",
    content: `Penyedia Produk,Stock Availability,Provider,Package Quota (GB),COGS,Kategori
DPT,OPEN,Telkomsel Individual Sharing,2,36000,Monthly Charge - IoT/M2M
RTS,OPEN,Telkomsel 1 GB,1,15000,Monthly Charge - Postpaid
DPT,CLOSED,Telkomsel 0.5 GB,0.5,55500,PAYU TSEL`,
  },

  edc_referral: {
    filename: "template_edc_referral.csv",
    label: "Referral Fee EDC",
    content: `No,Spec Type,Tier Quantity,Selling Price,Referral Fee Percentage,Simulation Quantity,Kategori,Remarks
1,abc,1–200,2875000,5%,200,EDC — One Time Charge,EDC Sekali Bayar
2,2/16/18,1–200,250000,5%,200,EDC — Rent (Monthly Charge),EDC Sewa Bulanan`,
  },

  router: {
    filename: "template_router.csv",
    label: "Router",
    content: `No,Nama Produk,Jenis Transaksi,Jangka Waktu Sewa,Minimum Quantity,Maximum Quantity,COGS CKU,COGS RTS,Markup,Remarks
1,Router C9 Non-IP SEC,Beli Putus,,1,9,1600000,1875000,45%,Beli Putus Standar
2,Router C9 Non-IP SEC,Sewa,12 bulan,1,9,1600000,287500,45%,Sewa 12 Bulan
3,Router C9 IP SEC,Beli Putus,,1,9,2300000,2500000,45%,Beli Putus IP SEC
4,Router C9 IP SEC,Sewa,12 bulan,1,9,2300000,383333,45%,Sewa IP SEC
5,Antena WiFi Router Dual Band,Aksesoris,,1,9,,,45%,Aksesoris Antena
6,Router Dongle D200,Beli Putus,,1,9,,,45%,Dongle USB`,
  },

  cloudsim: {
    filename: "template_cloudsim.csv",
    label: "Cloudsim",
    content: `No,Tipe Cloudsim,Jumlah Provider,Negara,Package Quota (GB),Licence Fee,Simbank,Quota Price,Markup,Bottom Line,Remarks
1,Monthly Charge — 3 Provider,3,Domestik,1,32000,12500,6500,45%,20%,3 Operator Domestik
2,Monthly Charge — 2 Provider,2,Domestik,1,32000,8333,6500,30%,20%,2 Operator Domestik
3,Monthly Charge — 1 Provider,1,Domestik,1,32000,4167,6500,30%,20%,1 Operator Domestik
4,Monthly Charge — 1 Provider Roaming,1,Malaysia,25,35000,,144500,30%,20%,Roaming Internasional`,
  },

  logistik: {
    filename: "template_logistik.csv",
    label: "Logistik",
    content: `origin_city_code,origin_city,destination_city_code,destination_city,service_type,product_name,start_weight,end_weight,rate_type,range_type,publish_rate,markup_percentage,remarks
ABU,ATAMBUA,ABU,ATAMBUA,package,REGPACK,1,1000,per_kg,CHARGEABLE_weight,,40%,Dalam kota Atambua
ABU,ATAMBUA,AEG,AEK GODANG,package,REGPACK,1,1000,per_kg,CHARGEABLE_weight,,40%,Atambua ke Aek Godang
CGK,JAKARTA,SUB,SURABAYA,package,REGPACK,1,1000,per_kg,CHARGEABLE_weight,15000,40%,Jakarta ke Surabaya`,
  },
};

export function downloadCsvTemplate(type) {
  const tpl = CSV_TEMPLATES[type] || CSV_TEMPLATES.simcard;
  const blob = new Blob([tpl.content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = tpl.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
