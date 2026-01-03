declare module 'pdf-parse/lib/pdf-parse.js' {
    const pdf: (dataBuffer: Buffer, options?: any) => Promise<any>;
    export default pdf;
}
