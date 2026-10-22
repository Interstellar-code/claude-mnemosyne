export declare const DEFAULT_DATA_DIR: string;
export declare const BANKS_DIR: string;
export declare class ValueError extends Error {
    name: string;
}
export interface BankStats {
    readonly name: string;
    readonly exists: boolean;
    readonly db_path: string;
    readonly dbSizeBytes: number;
    readonly db_size_bytes: number;
}
export declare class BankManager {
    readonly dataDir: string;
    readonly banksDir: string;
    constructor(dataDir?: string);
    createBank(name: string): string;
    deleteBank(name: string, force?: boolean): boolean;
    listBanks(): string[];
    bankExists(name: string): boolean;
    getBankDbPath(name: string): string;
    renameBank(oldName: string, newName: string): string;
    getBankStats(name: string): BankStats;
    private validateName;
}
export declare function createBank(name: string, dataDir?: string): string;
export declare function deleteBank(name: string, dataDir?: string, force?: boolean): boolean;
export declare function listBanks(dataDir?: string): string[];
export declare function bankExists(name: string, dataDir?: string): boolean;
export declare function bankDbPath(name?: string, dataDir?: string): string;
export declare function setBank(bank: string): void;
export declare function getBank(): string;
export declare function resetBankForTests(): void;
