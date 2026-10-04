// src/services/fetch.ts
export async function fetchData(url: string, data?: object) {
  // No navegador, URLs relativas já resolvem para o host correto (o mesmo
  // que serviu a página), então não devem ser reescritas para uma URL fixa —
  // isso quebraria o acesso vindo de outros dispositivos na rede.
  // No servidor (SSR/API routes chamando outras rotas), fetch exige URL absoluta.
  const isServer = typeof window === 'undefined'

  const parsedUrl = url.startsWith('/') && isServer
    ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3993'}${url}`
    : url;

  try {
    const resp = await fetch(parsedUrl, data);
    
    if (!resp.ok) {
      throw new Error(`HTTP:${parsedUrl} ${resp.status} - ${resp.statusText}`);
    }

    return await resp.json();
  } catch (error) {
    console.error(`Falha ao buscar ${parsedUrl}:`, error);
    return { message: 'Erro ao carregar dados' };
  }
}
