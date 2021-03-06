import {CsContentsGroupGenerator} from './cs-contents-group-generator';
import {searchResult} from './cs-contents-group-generator.spec.data';
import {CsSortOrder} from '../../interface';

describe('ContentGroupGenerator', () => {
    it('should be able to generate contents grouped by its attributes', () => {
        // assert
        expect(
            CsContentsGroupGenerator.generate(
                searchResult.result.content as any,
                'subject',
                {
                    sortAttribute: 'name',
                    sortOrder: CsSortOrder.ASC,
                },
                {
                    medium: ['invalid_medium', 'english', 'hindi'],
                    gradeLevel: ['class 2', 'invalid']
                },
            )
        ).toMatchSnapshot();
    });
});
