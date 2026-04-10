async function testApi() {
    try {
        const res = await fetch('http://localhost:5000/api/legal/privacy');
        const data = await res.json();
        console.log('Privacy Policy response:', JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('API Test Failed:', err.message);
    }
}
testApi();
