// src/services/fetch.ts
export async function fetchData(url: string, data?: object) {
  // // Verifique se está no servidor (build/SSR)
  // if (typeof window === 'undefined' && !process.env.API_URL) {
  //   throw new Error('API_URL não definida para o ambiente de build');
  // }

  const parsedUrl = url.startsWith('/')
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
