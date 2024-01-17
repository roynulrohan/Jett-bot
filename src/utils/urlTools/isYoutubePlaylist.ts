export default (url: string) => {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname === 'www.youtube.com' && parsedUrl.pathname === '/playlist' ? true : false;
};
