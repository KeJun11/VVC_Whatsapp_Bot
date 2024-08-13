const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs'); // For reading the image file

// Function to start the bot
const startBot = async () => {
    // Setup authentication state
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

    // Initialize the socket connection
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    });

    // Save credentials
    sock.ev.on('creds.update', saveCreds);

    // Display QR code in the terminal for authentication
    sock.ev.on('connection.update', (update) => {
        const { connection, qr, lastDisconnect } = update;

        if (qr) {
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut);
            console.log('Connection closed due to', lastDisconnect.error, ', reconnecting', shouldReconnect);
            if (shouldReconnect) {
                startBot();
            }
        } else if (connection === 'open') {
            console.log('Connected');
        }
    });

    userStates = {};
    liveChatQueue = [];
    adminJid = '6588684707@s.whatsapp.net'; //88054186

    // Listening to incoming messages
    sock.ev.on('messages.upsert', async (m) => {

        const msg = m.messages[0];
        console.log(msg);

        // if a message has been received (!msg.key.fromMe &&)
        if (m.type === 'notify') {
            
            // msg.message.conversation.trim(); This for conversation with others

            let reply = "";
            let msgText = "";
            let remoteJid = "";
            let data = require('./data.json');

            if (msg.key.fromMe) {
                msgText = msg.message.extendedTextMessage.text.trim();
                if (msgText.toLowerCase() === 'clear') {
                    liveChatQueue.shift();
                    let liveChatMsgforAdminJSON = {text: "Current Queue:\n" + liveChatQueue.join("\n")}
                    await sock.sendMessage(adminJid, liveChatMsgforAdminJSON);
                }
                return;

            } else {
                msgText = msg.message.conversation.trim();
                remoteJid = msg.key.remoteJid;
                console.log('Received message object:'); // Debug log
            }

            // Check if it is a new user
            if (!userStates[remoteJid]) {
                userStates[remoteJid] = {ChosenTopicIdx: -1, ChosenQuestionIdx: -1, page: 8, RequiresSupport: false};
            }
        
            console.log('Processing message:');

            if (msgText === "REQUEST") {
                userStates[remoteJid].RequiresSupport = true;

                // let them know number of users in queue before adding them to queue
                let liveChatMsg = '';
                {liveChatQueue.length > 0 ? liveChatMsg = `there are ${liveChatQueue.length} in the queue now,`: liveChatMsg = '' }
                reply = `Reaching out to live team now, ${liveChatMsg} thank you for your patience!\n\nTo switch back to questions, please type : "BOT"`;
                liveChatQueue.push(remoteJid);
                
                replyJSON = {text: reply}
                // send message back to user
                await sock.sendMessage(msg.key.remoteJid, replyJSON);
                
                let liveChatMsgforAdminJSON = {text: "Current Queue:\n" + liveChatQueue.join("\n")}
                // send message to admin regarding
                await sock.sendMessage(adminJid, liveChatMsgforAdminJSON);
                console.log('Message sent!'); // Confirm the message was sent
            }

            if (msgText === "BOT") {
                userStates[remoteJid].RequiresSupport = false;
            }

            if (!userStates[remoteJid].RequiresSupport) {

                // If user types the word back or Back
                if (msgText.toLowerCase() === 'back') {
                    if(userStates[remoteJid].ChosenQuestionIdx !== -1) {
                        userStates[remoteJid].ChosenQuestionIdx = -1;
                    } else if (userStates[remoteJid].ChosenTopicIdx !== -1) {
                        userStates[remoteJid].ChosenTopicIdx = -1;
                    }
                }

                // Check if user has chose a topic
                if(userStates[remoteJid].ChosenTopicIdx === -1) {

                    // set user input as topicIdx
                    if (!isNaN(msgText)) {
                        msgNumber = Number(msgText);

                        if(msgNumber >= 0 && msgNumber < data.Topics.length) {
                            topicIdx = msgNumber;
                            topic = data.Topics[topicIdx];
                            listQuestions = data[topic].questions.slice(0,8).map((item, index) => (index + '. ' + item)).join("\n");
                            {data[topic].questions.length > 8 ? nextText = 'Next page (type Next)' : nextText = ''};
                            reply = `Chosen Topic: "${topic}"\n\nType 'Back' to go back to Topic selection\n\nPlease choose a question by selecting a NUMBER:\n\n${listQuestions}\n\n${nextText}`;
                            userStates[remoteJid].ChosenTopicIdx = topicIdx;
                        }

                    } else {
                        let listTopics = data.Topics.map((item, index) => (index + '. ' + item)).join("\n");
                        reply = `Hello! This is Vivace FAQbot! Please choose a FAQ topic by selecting a NUMBER:\n\n${listTopics}\n\nIf you would like to speak to our live support team, type: "REQUEST"`;
                    }

                // Check if user has a question
                } else if (userStates[remoteJid].ChosenQuestionIdx === -1) {

                    // get user chosen topic
                    topicIdx = userStates[remoteJid].ChosenTopicIdx;
                    topic = data.Topics[topicIdx];
                    topicData = data[topic];

                    if (!isNaN(msgText)) {
                        msgNumber = Number(msgText);

                        // set user input as chosen question index
                        if(msgNumber >= 0 && msgNumber < topicData.questions.length) {
                            questionIdx = msgNumber;
                            question = topicData.questions[questionIdx];
                            answer = topicData.answers[questionIdx];
                            reply = `Type 'Back' to go back to Question selection\n\nQ: ${question}\n\nA: ${answer}`;
                            userStates[remoteJid].ChosenQuestionIdx = questionIdx;
                        }
                    } else {

                        if(msgText.toLowerCase() === 'next' && topicData.questions.length >= userStates[remoteJid].page) {
                            userStates[remoteJid].page = userStates[remoteJid].page + 8;
                        }
                        if (msgText.toLowerCase() === 'prev' && userStates[remoteJid].page > 8) {
                            userStates[remoteJid].page = userStates[remoteJid].page - 8;
                        }
                        let startPageNo = userStates[remoteJid].page - 8;
                        let endPageNo = userStates[remoteJid].page
                        console.log("Start: ", startPageNo, "End: ", endPageNo);
                        {topicData.questions.length > userStates[remoteJid].page ? nextText = 'Next page (type Next)' : nextText = 'Prev page (type Prev)'};
                        let ls = [];
                        for (let i = startPageNo; i < endPageNo; i++) {
                            if (topicData.questions[i] !== undefined) {
                                let txt = i + '. ' + topicData.questions[i];
                                ls.push(txt);
                            }
                        }
                        
                        listQuestions = ls.join("\n");
                        // topicData.questions.slice(startPageNo, endPageNo).map((item, index) => (index + '. ' + item)).join("\n")
                        reply = `Chosen Topic: "${topic}"\n\nType 'Back' to go back to Topic selection\n\nPlease choose a question by selecting a NUMBER:\n\n${listQuestions}\n\n${nextText}`;
                    }
                } else {
                    reply = "Please reply 'Back' to return to the previous menu";
                }

                console.log(userStates[remoteJid].ChosenTopicIdx);
                console.log(userStates[remoteJid].ChosenQuestionIdx);

                // Reply to the message
                
                if(reply[reply.length-1] === '}') {
                    replyJSON = {
                        image : { url: "./VVC_map.png" }, 
                        caption: "Vivace Map"
                    }
                } else {
                    replyJSON = {text: reply};
                }
                
                await sock.sendMessage(msg.key.remoteJid, replyJSON);
                console.log('Message sent!'); // Confirm the message was sent

            }
        }
    });
};

// Start the bot
startBot();