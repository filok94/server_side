import { UserGames, UserGamesDocument } from './schemas/user_games.schema'
import {
  IGetUserGameResult,
  ILinkResultToDB,
  IReturnedBriefGames,
  IReturnedCalculatedData,
  IReturnedCalculatedResult,
  IReturnedGameResults
} from './games.interface.d'
import { IReturnedOneQuestion } from './games.interface'
import { DtoCalculate } from './dto/calculate.dto'
import { ErrorMessages } from './../exceptions/exceptions'
import { DtoCreateGame } from './dto/create_game.dto'
import { Game, GameDocument, TestData } from './schemas/game.schema'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import mongoose, { Model } from 'mongoose'
import { DtoIdParams } from './dto/queries.dto'
import { TokenService } from '../auth/token.service'
import { Person, PersonDocument } from './schemas/person.schema'

@Injectable()
export class GamesService {
  constructor (
		@InjectModel(Game.name) private gameModel: Model<GameDocument>,
		@InjectModel(Person.name) private personModel: Model<PersonDocument>,
		@InjectModel(UserGames.name)
		private userGamesModel: Model<UserGamesDocument>,
		private tokenService: TokenService
  ) { }

  async getAllGames (): Promise<IReturnedBriefGames[]> {
    try {
      return (await this.gameModel.find()).map((e) => {
        return {
          title: e.title,
          description: e.description,
          link: e.link,
          _id: e._id,
          persons: e.persons
        }
      })
    } catch (e) {
      throw new Error(e)
    }
  }

  async adminGetGameById (id: mongoose.Schema.Types.ObjectId): Promise<{
		game: GameDocument;
	}> {
    try {
      const game = await this.gameModel.findById(id)
      return {
        game
      }
    } catch (e) {
      throw new Error(ErrorMessages.NOT_FOUND)
    }
  }

  async adminCreateGame (
    dto: DtoCreateGame
  ): Promise<mongoose.Schema.Types.ObjectId> {
    try {
      const personsInDb = await this.personModel.find({
        _id: {
          $in: dto.persons
        }
      })

      // validation
      if (personsInDb.length !== dto.persons.length) {
        throw new Error(ErrorMessages.PERSON_NOT_FOUND)
      }

      const newGame = await this.gameModel.create(dto)
      return newGame._id
    } catch (e) {
      throw new Error(e)
    }
  }

  async adminDeleteGame (gameId: mongoose.Schema.Types.ObjectId): Promise<string> {
    try {
      const gameToDelete = await this.gameModel.findOneAndDelete({ _id: gameId })

      if (!gameToDelete) {
        throw new Error(ErrorMessages.CANNOT_FIND_GAME)
      }
      return gameToDelete.title
    } catch (e) {
      throw new Error(e)
    }
  }

  async getQuestionsForGame (
    param: DtoIdParams
  ): Promise<IReturnedOneQuestion[]> {
    try {
      const gameData = await this.gameModel.findOne({
        _id: param.id
      })

      // validation
      if (!gameData) throw new Error(ErrorMessages.CANNOT_FIND_GAME)

      const returnedArray: IReturnedOneQuestion[] = gameData.test_data.map(
        (e) => {
          return {
            question: e.question,
            answers: e.answers,
            index: e.index
          }
        }
      )
      return returnedArray
    } catch (e) {
      throw new Error(e)
    }
  }

  private async calculateResult (
    dto: DtoCalculate,
    testData: TestData[]
  ): Promise<IReturnedCalculatedResult[]> {
    try {
      const answersAndResults: IReturnedCalculatedResult[] = []
      dto.answers.forEach((e) => {
        const answerObject = testData.find(
          (dbElement) => dbElement.index === e.index
        )

        const isRight = e.answer === answerObject.right_answer
        answersAndResults.push({
          right_answer: answerObject.right_answer,
          user_answer: e.answer,
          is_right: isRight,
          index: e.index
        })
      })

      return answersAndResults
    } catch (e) {
      throw new Error(e)
    }
  }

  async setResultData (
    gameId: mongoose.Schema.Types.ObjectId,
    dto: DtoCalculate,
    userToken: string
  ): Promise<IReturnedCalculatedData> {
    try {
      const gameDbInfo = await this.gameModel
          .findById(gameId)
          .populate<{ persons: PersonDocument[] }>({
            path: 'persons',
            model: this.personModel
          })
          .exec()

      // error handling
      if (!gameDbInfo) {
        throw new Error(ErrorMessages.WRONG_GAME_ID)
      }
      const gameIndexesCheckDb = gameDbInfo.test_data.map((e) => e.index)
      const gameIndexesCheckDbSet = new Set(gameIndexesCheckDb)
      const gameIndexesCheckDto = dto.answers.map((e) => e.index)
      const gameIndexesCheckDtoSet = new Set(gameIndexesCheckDto)
      const isIndexesRight =
				gameIndexesCheckDb.length === gameIndexesCheckDto.length &&
				gameIndexesCheckDto.filter((e) => !gameIndexesCheckDb.includes(e))
				    .length === 0
      if (
        !isIndexesRight ||
				gameIndexesCheckDbSet.size !== gameIndexesCheckDtoSet.size
      ) {
        throw new Error(ErrorMessages.WRONG_QUESTION_DATA)
      }
      // set results
      const test_result = await this.calculateResult(dto, gameDbInfo.test_data)
      const countOfRightAnswers = test_result.filter((e) => e.is_right).length
      const person = gameDbInfo.persons.find(
        (e) => e.count === countOfRightAnswers
      )
      const user = await this.tokenService.getUserByToken(userToken)
      await this.linkResultToUser({
        right_answers_count: countOfRightAnswers,
        person: person._id,
        game: gameId,
        user: user.id,
        test_data: test_result
      })
      return {
        person,
        test_result
      }
    } catch (e) {
      throw new Error(e)
    }
  }

  private async linkResultToUser (
    dataToSave: ILinkResultToDB
  ): Promise<mongoose.Schema.Types.ObjectId> {
    try {
      const newData = await this.userGamesModel.findOneAndUpdate(
        {
          game: dataToSave.game,
          user: dataToSave.user
        },
        {
          game: dataToSave.game,
          user: dataToSave.user,
          right_answers_count: dataToSave.right_answers_count,
          person: dataToSave.person,
          test_data: dataToSave.test_data
        },
        {
          upsert: true, new: true
        }
      )
      return newData.id
    } catch (e) {
      throw new Error(e)
    }
  }

  async getUserResults (
    data: IGetUserGameResult
  ): Promise<IReturnedGameResults> {
    try {
      const gameData =
				await this.userGamesModel.aggregate<IReturnedGameResults>([
				  {
				    $lookup: {
				      from: 'tokens',
				      foreignField: 'user',
				      localField: 'user',
				      as: 'tokensObj'
				    }
				  },
				  {
				    $match: {
				      'tokensObj.access_token': data.user
				    }
				  },
				  {
				    $lookup: {
				      from: 'games',
				      foreignField: '_id',
				      localField: 'game',
				      as: 'game_title'
				    }
				  },
				  {
				    $lookup: {
				      from: 'persons',
				      foreignField: '_id',
				      localField: 'person',
				      as: 'person'
				    }
				  },
				  {
				    $set: {
				      game_title: {
				        $arrayElemAt: ['$game_title.title', 0]
				      },
				      game_id: {
				        $arrayElemAt: ['$game_title._id', 0]
				      },
				      person: {
				        $arrayElemAt: ['$person', 0]
				      }
				    }
				  },
				  {
				    $project: {
				      game_title: true,
				      game_id: true,
				      person: true,
				      test_data: true,
				      _id: false
				    }
				  }
				])
      if (!gameData.length) {
        throw new Error(ErrorMessages.CANNOT_FIND_RESULTS)
      }
      return {
        ...gameData[0]
      }
    } catch (e) {
      throw new Error(e)
    }
  }

  async createFakeGame (title: string): Promise<mongoose.Schema.Types.ObjectId> {
    try {
      const persons: mongoose.Schema.Types.ObjectId[] = (await this.personModel.find({}, { _id: 1 })).slice(0, 8).map(e => e._id)
      const test_data = Array.from(Array(8).keys()).map(i => {
        return {
          question: `question-${i + 1}`,
          answers: [`q-${i} answer-1`,
                    `q-${i} answer-2`,
                    `q-${i} answer-3`,
                    `q-${i} answer-4`],
          right_answer: Math.floor(Math.random() * (3 - 0 + 1) + 0),
          index: i
        }
      })

      const game: DtoCreateGame = {
        title,
        description: `${title}-description`,
        link: `https://${title}-link`,
        test_data,
        persons
      }

      return await this.adminCreateGame(game)
    } catch (e) {
      throw new Error(e)
    }
  }
}
