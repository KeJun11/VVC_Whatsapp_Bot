const fs = require('fs'); // For reading the image file

const resetSession = () => {
    const sessionPath = './auth_info';
    
    if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        console.log('Session reset. A new QR code will be generated on restart.');
    }
};

resetSession();