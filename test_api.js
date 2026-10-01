const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

async function test() {
  const supplierId = process.env.TRENDYOL_GO_SUPPLIER_ID;
  const token = process.env.TRENDYOL_TOKEN;
  
  const HEADERS = {
    "Authorization": `Basic ${token}`,
    "x-agentname": process.env.TRENDYOL_GO_AGENTNAME,
    "x-executor-user": process.env.TRENDYOL_GO_EXECUTOR_USER,
  };

  const startMs = new Date(2026, 8, 1).getTime(); // Sep 1, 2026
  const endMs = startMs + 14 * 24 * 60 * 60 * 1000 - 1; // Sep 15, 2026

  console.log("Fetching from", new Date(startMs), "to", new Date(endMs));

  try {
    const res = await axios.get(
      `https://api.tgoapis.com/integrator/order/grocery/suppliers/${supplierId}/packages`,
      {
        headers: HEADERS,
        params: {
          startDate: startMs,
          endDate: endMs,
          size: 200,
          page: 0,
        },
        timeout: 10000
      }
    );
    console.log("Success! Total Elements:", res.data.totalElements, "Total Pages:", res.data.totalPages);
    console.log("Content Length:", res.data.content?.length);
  } catch (err) {
    console.error("Error fetching data:");
    if (err.response) {
      console.error(err.response.status, err.response.data);
    } else {
      console.error(err.message);
    }
  }
}

test();
