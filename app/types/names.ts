export type NodeId = string;

export interface NodeNames {
  [nodeId: NodeId]: string;
}

export interface Sea {
  /** 海域コード例: "1-1" */
  code: string;
  /** 海域表示名 */
  name: string;
  /** マスID→表示名の対応表 */
  nodes: NodeNames;
  /** 表示順（任意） */
  order?: number;
}

export interface SeaGroup {
  /** グループID例: "1" */
  id: string;
  /** グループ表示名 */
  name: string;
  /** グループ内の海域一覧 */
  seas: Sea[];
  /** 表示順（任意） */
  order?: number;
}

export interface NamesData {
  /** スキーマバージョン */
  version: number;
  /** 海域グループ一覧 */
  groups: SeaGroup[];
}
