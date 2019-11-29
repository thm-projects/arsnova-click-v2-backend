export interface INickSessionConfiguration {
  memberGroups: Array<string>;
  maxMembersPerGroup: number;
  autoJoinToGroup: boolean;
  selectedNicks: Array<string>;
  blockIllegalNicks: boolean;
  restrictToCasLogin: boolean;
}