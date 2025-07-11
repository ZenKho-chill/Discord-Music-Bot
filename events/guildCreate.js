module.exports = async (client, guild) => {
  const botMember = guild.members.me;
  const permissions = botMember.permissions;

  const requiredPermissions = [
    "SendMessages",
    "Connect",
    "Speak",
    "ViewChannel",
    "UseApplicationCommands"
  ];

  const missing = requiredPermissions.filter(perm => !permissions.has(perm));
  if (missing.length > 0) {
    console.warn(`⚠️ "${guild.name}" thiếu quyền: `, missing.join(", "));
    const defaultChannel = guild.systemChannel || guild.channes.cache.find(c => c.isTextBased() && c.permissionsFor(botMember).has("SendMessages"));
    if (defaultChannel) {
      defaultChannel.send(`⚠️ Bot không có đủ quyền để hoạt động!\nThiếu quyền: ${missing.join(', ')}`);
    }
  } else {
    console.log(`✔ Bot đã vào máy chủ "${guild.name}" với đủ quyền.`);
  }
};