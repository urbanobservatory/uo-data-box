export interface Pagination {
  pageNumber?: number;
  pageSize?: number;
  pageCount?: number;
  total?: number;
}

export interface Response {
  pagination: Pagination;
  items: any[];
}

export class PageHandler {
  public static wrapOutput(pagination: Pagination, items: any): Response {
    const imposedPagination = this.sanitise(pagination);
    return {
      pagination: {
        ...imposedPagination,
        pageNumber: imposedPagination.pageNumber,
        pageCount: Math.ceil(items.total / imposedPagination.pageSize),
        total: items.total
      },
      items: items.results
    };
  }

  public static sanitise(pagination: Pagination): Pagination {
    if (isNaN(parseInt(<any>pagination.pageSize, 10))) {
      pagination.pageSize = 10;
    }
    if (isNaN(parseInt(<any>pagination.pageNumber, 10))) {
      pagination.pageNumber = 1;
    }
    const pageNumber = Math.max(1, parseInt(<any>pagination.pageNumber, 10) || 1);
    const pageSize = Math.max(5, Math.min(100, parseInt(<any>pagination.pageSize, 10) || 10));
    return {
      pageNumber,
      pageSize
    };
  }

  public static impose(pagination: Pagination) {
    const sanePaging = this.sanitise(pagination);
    return [sanePaging.pageNumber - 1, sanePaging.pageSize];
  }
}
