const ngrok = require('@ngrok/ngrok');

const PORT = process.env.PORT || 3000;
const AUTHTOKEN = process.env.NGROK_AUTHTOKEN || '3IscPmrJGEr1JvCKtkQWo0RW6bl_3K6qCGtyEMbVhmMcLdd4h';
const DOMAIN = process.env.NGROK_DOMAIN || 'tribute-gents-devotion.ngrok-free.dev';

async function startTunnel() {
  try {
    console.log('🔄 Conectando ao ngrok...');
    const session = await ngrok.forward({
      addr: PORT,
      authtoken: AUTHTOKEN,
      domain: DOMAIN
    });

    const publicUrl = session.url();
    console.log('\n======================================================');
    console.log('🚀 TÚNEL NGROK ATIVO E COMPARTILHADO COM SUCESSO!');
    console.log(`🌐 URL Pública: ${publicUrl}`);
    console.log(`🎮 Acesso Local: http://localhost:${PORT}`);
    console.log('Envie o link público para qualquer pessoa jogar com você!');
    console.log('Pressione Ctrl+C para encerrar o túnel.');
    console.log('======================================================\n');

    // Mantém o processo ativo no terminal
    process.stdin.resume();
  } catch (err) {
    console.error('❌ Erro ao iniciar túnel ngrok:', err.message);
  }
}

startTunnel();
