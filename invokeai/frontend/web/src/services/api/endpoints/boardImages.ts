import { OffsetPaginatedResults_ImageDTO_ } from 'services/api/types';
import { ApiFullTagDescription, LIST_TAG, api } from '..';
import { paths } from '../schema';

type ListBoardImagesArg =
  paths['/api/v1/board_images/{board_id}']['get']['parameters']['path'] &
    paths['/api/v1/board_images/{board_id}']['get']['parameters']['query'];

type AddImageToBoardArg =
  paths['/api/v1/board_images/']['post']['requestBody']['content']['application/json'];

type RemoveImageFromBoardArg =
  paths['/api/v1/board_images/']['delete']['requestBody']['content']['application/json'];

export const boardImagesApi = api.injectEndpoints({
  endpoints: (build) => ({
    /**
     * Board Images Queries
     */

    listBoardImages: build.query<
      OffsetPaginatedResults_ImageDTO_,
      ListBoardImagesArg
    >({
      query: ({ board_id, offset, limit }) => ({
        url: `board_images/${board_id}`,
        method: 'GET',
      }),
      providesTags: (result, error, arg) => {
        // any list of boardimages
        const tags: ApiFullTagDescription[] = [
          { type: 'BoardImage', id: `${arg.board_id}_${LIST_TAG}` },
        ];

        if (result) {
          // and individual tags for each boardimage
          tags.push(
            ...result.items.map(({ board_id, image_name }) => ({
              type: 'BoardImage' as const,
              id: `${board_id}_${image_name}`,
            }))
          );
        }

        return tags;
      },
    }),

    /**
     * Board Images Mutations
     */

    addImageToBoard: build.mutation<void, AddImageToBoardArg>({
      query: ({ board_id, image_name }) => ({
        url: `board_images/`,
        method: 'POST',
        body: { board_id, image_name },
      }),
      invalidatesTags: (result, error, arg) => [
        { type: 'BoardImage' },
        { type: 'Board', id: arg.board_id },
      ],
    }),

    removeImageFromBoard: build.mutation<void, RemoveImageFromBoardArg>({
      query: ({ board_id, image_name }) => ({
        url: `board_images/`,
        method: 'DELETE',
        body: { board_id, image_name },
      }),
      invalidatesTags: (result, error, arg) => [
        { type: 'BoardImage' },
        { type: 'Board', id: arg.board_id },
      ],
    }),
  }),
});

export const {
  useAddImageToBoardMutation,
  useRemoveImageFromBoardMutation,
  useListBoardImagesQuery,
} = boardImagesApi;
