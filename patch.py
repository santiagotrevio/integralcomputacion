path = '/Users/santiago/Documents/GitHub/integralcomputacion/public/admin/cotizador.html'
content = open(path).read()

import re

old_logic = """            // Explicit Pagination Logic
            const chunkedPages = [];
            const itemsCopy = [...quoteItems];
            const itemsLimitWithTotals = 5;
            const itemsLimitWithoutTotals = 6;

            while (itemsCopy.length > 0) {
                let takeCount = itemsLimitWithoutTotals;
                if (itemsCopy.length <= itemsLimitWithTotals) {
                    takeCount = itemsCopy.length;
                } else if (itemsCopy.length === itemsLimitWithoutTotals) {
                    takeCount = itemsLimitWithoutTotals - 1;
                }
                chunkedPages.push(itemsCopy.splice(0, takeCount));
            }
            if (chunkedPages.length === 0) chunkedPages.push([]);"""

new_logic = """            // Explicit Pagination Logic - Optimizada para no dejar huecos
            const chunkedPages = [];
            const itemsCopy = [...quoteItems];

            const FIRST_PAGE_MAX_WITH_TOTALS = 10;
            const FIRST_PAGE_MAX_NO_TOTALS = 15;
            const MIDDLE_PAGE_MAX = 20;
            const LAST_PAGE_MAX_WITH_TOTALS = 14;
            const MIN_ITEMS_LAST_PAGE = 3;

            let isFirst = true;
            while (itemsCopy.length > 0) {
                let take;
                let len = itemsCopy.length;

                if (isFirst) {
                    if (len <= FIRST_PAGE_MAX_WITH_TOTALS) {
                        take = len;
                    } else if (len <= FIRST_PAGE_MAX_NO_TOTALS) {
                        take = len - MIN_ITEMS_LAST_PAGE;
                        if (take < 1) take = 1;
                    } else {
                        let remain = len - FIRST_PAGE_MAX_NO_TOTALS;
                        if (remain > 0 && remain < MIN_ITEMS_LAST_PAGE) {
                            take = FIRST_PAGE_MAX_NO_TOTALS - (MIN_ITEMS_LAST_PAGE - remain);
                        } else {
                            take = FIRST_PAGE_MAX_NO_TOTALS;
                        }
                    }
                    isFirst = false;
                } else {
                    if (len <= LAST_PAGE_MAX_WITH_TOTALS) {
                        take = len;
                    } else if (len <= MIDDLE_PAGE_MAX) {
                        take = len - MIN_ITEMS_LAST_PAGE;
                        if (take < 1) take = 1;
                    } else {
                        let remain = len - MIDDLE_PAGE_MAX;
                        if (remain > 0 && remain < MIN_ITEMS_LAST_PAGE) {
                            take = MIDDLE_PAGE_MAX - (MIN_ITEMS_LAST_PAGE - remain);
                        } else {
                            take = MIDDLE_PAGE_MAX;
                        }
                    }
                }
                chunkedPages.push(itemsCopy.splice(0, take));
            }
            if (chunkedPages.length === 0) chunkedPages.push([]);"""

if old_logic in content:
    content = content.replace(old_logic, new_logic)
    open(path, 'w').write(content)
    print("Logic replaced successfully.")
else:
    print("Pattern not found! Make sure exact spacing matches.")
